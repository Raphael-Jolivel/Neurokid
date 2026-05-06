import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminService, AdminQuestion, GeneratedQuestion } from '../../../services/admin/admin-service';
import { NotificationService } from '../../../services/notification/notification-service';

@Component({
  selector: 'app-admin-generate',
  imports: [CommonModule, FormsModule],
  templateUrl: './admin-generate.html'
})
export class AdminGeneratePage {

  public DOMAINS = ['Memory', 'Logic & Reasoning', 'Attention & Focus'] as const;
  public DIFFICULTIES = ['easy', 'medium', 'hard'] as const;

  // Gemini API key (localStorage)
  public openAIKey = '';
  public keyVisible = false;

  // Generation parameters
  public selectedDomain: 'Memory' | 'Logic & Reasoning' | 'Attention & Focus' = 'Memory';

  // State
  public loading = false;
  public generated: GeneratedQuestion | null = null;
  public chosenDifficulty: 'easy' | 'medium' | 'hard' = 'easy';

  constructor(private admin: AdminService,
              private notification: NotificationService) {
    this.openAIKey = this.admin.getOpenAIKey();
  }

  // ---- Gemini API key ----
  saveKey(): void {
    const k = (this.openAIKey || '').trim();
    if (!k) {
      this.notification.error('Please enter a Gemini API key');
      return;
    }
    this.admin.setOpenAIKey(k);
    this.notification.success('Gemini API key saved in the browser');
  }

  clearKey(): void {
    this.admin.clearOpenAIKey();
    this.openAIKey = '';
    this.notification.success('Gemini API key removed from the browser');
  }

  hasKey(): boolean {
    return this.admin.hasOpenAIKey();
  }

  // ---- Generation ----
  generate(): void {
    if (!this.hasKey()) {
      this.notification.error('Missing Gemini API key. Enter it above.');
      return;
    }
    this.loading = true;
    this.generated = null;
    this.admin.generateQuestion(this.selectedDomain).subscribe({
      next: (q) => {
        this.generated = q;
        this.chosenDifficulty = q.suggested_difficulty || 'easy';
        this.loading = false;
        this.notification.success('Question generated');
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.error || 'Generation failed';
        this.notification.error(msg);
      }
    });
  }

  // ---- Validation / reject ----
  validate(): void {
    if (!this.generated) return;
    const q: AdminQuestion = {
      domain: this.selectedDomain,
      difficulty: this.chosenDifficulty,
      question_text: this.generated.question_text,
      answer_key: this.generated.answer_key || [],
      eval_type: this.generated.eval_type || 'contains',
      source: 'ai',
    };
    this.admin.createQuestion(q).subscribe({
      next: () => {
        this.notification.success('Question validated and added to the bank');
        this.generated = null;
      },
      error: (err) => {
        const msg = err?.error?.errors?.join(', ') || err?.error?.error || 'Error';
        this.notification.error(msg);
      }
    });
  }

  reject(): void {
    this.generated = null;
    this.notification.success('Question rejected');
  }

  // ---- Helpers ----
  answerKeyAsText(q: GeneratedQuestion | null): string {
    if (!q) return '';
    return (q.answer_key || []).join(', ');
  }
}
