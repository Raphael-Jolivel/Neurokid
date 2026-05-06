import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminQuestion } from '../../../services/admin/admin-service';
import { NotificationService } from '../../../services/notification/notification-service';

@Component({
  selector: 'app-admin-questions',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-questions.html'
})
export class AdminQuestionsPage implements OnInit {

  public loading = true;
  public questions: AdminQuestion[] = [];
  public filterDomain = '';
  public filterDifficulty = '';

  // Inline editing
  public editingId: number | null = null;
  public editing: AdminQuestion = this.emptyQ();

  // Creation
  public creating = false;
  public newQ: AdminQuestion = this.emptyQ();

  public DOMAINS = ['Memory', 'Logic & Reasoning', 'Attention & Focus'] as const;
  public DIFFICULTIES = ['easy', 'medium', 'hard'] as const;
  public EVAL_TYPES = ['contains', 'sequence'] as const;

  constructor(private admin: AdminService,
              private notification: NotificationService) {}

  ngOnInit(): void { this.reload(); }

  emptyQ(): AdminQuestion {
    return {
      domain: 'Memory',
      difficulty: 'easy',
      question_text: '',
      answer_key: [],
      eval_type: 'contains',
      source: 'admin',
    };
  }

  reload(): void {
    this.loading = true;
    this.admin.listQuestions({
      domain: this.filterDomain || undefined,
      difficulty: this.filterDifficulty || undefined,
    }).subscribe({
      next: (rows) => { this.questions = rows || []; this.loading = false; },
      error: (err) => {
        this.notification.error(err?.error?.error || 'Loading error');
        this.loading = false;
      }
    });
  }

  // Helper for textarea <-> array binding
  answerKeyAsText(q: AdminQuestion): string {
    return (q.answer_key || []).join(', ');
  }
  setAnswerKeyFromText(q: AdminQuestion, text: string): void {
    q.answer_key = (text || '').split(',').map(s => s.trim()).filter(Boolean);
  }

  startEdit(q: AdminQuestion): void {
    this.editingId = q.id ?? null;
    this.editing = { ...q, answer_key: [...(q.answer_key || [])] };
  }

  cancelEdit(): void {
    this.editingId = null;
    this.editing = this.emptyQ();
  }

  saveEdit(): void {
    if (this.editingId == null) return;
    this.admin.updateQuestion(this.editingId, this.editing).subscribe({
      next: () => {
        this.notification.success('Question updated');
        this.cancelEdit();
        this.reload();
      },
      error: (err) => this.notification.error(this.errMsg(err))
    });
  }

  remove(q: AdminQuestion): void {
    if (q.id == null) return;
    const ok = confirm(`Delete question #${q.id}?`);
    if (!ok) return;
    this.admin.deleteQuestion(q.id).subscribe({
      next: () => {
        this.notification.success('Question deleted');
        this.reload();
      },
      error: (err) => this.notification.error(this.errMsg(err))
    });
  }

  startCreate(): void {
    this.creating = true;
    this.newQ = this.emptyQ();
  }

  cancelCreate(): void {
    this.creating = false;
    this.newQ = this.emptyQ();
  }

  saveCreate(): void {
    this.admin.createQuestion(this.newQ).subscribe({
      next: () => {
        this.notification.success('Question created');
        this.cancelCreate();
        this.reload();
      },
      error: (err) => this.notification.error(this.errMsg(err))
    });
  }

  private errMsg(err: any): string {
    if (err?.error?.errors) return err.error.errors.join(', ');
    return err?.error?.error || 'Error';
  }
}
