import { Component, OnInit } from '@angular/core';
import { ActivatedRoute, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { SessionService } from '../../services/session/session-service';
import { NotificationService } from '../../services/notification/notification-service';

@Component({
  selector: 'app-quiz-page',
  imports: [CommonModule, FormsModule],
  templateUrl: './quiz-page.html',
  styleUrl: './quiz-page.scss'
})
export class QuizPage implements OnInit {

  public sessionId: string = '';
  public loading: boolean = true;
  public submitting: boolean = false;

  public question: any = null;
  public answer: string = '';

  public attempts: number = 1;
  public questionStart: number = 0;

  // Feedback
  public lastFeedback: { correct: boolean; partial: number; predicted: number; message: string } | null = null;
  public showFeedback: boolean = false;

  public progress: number = 0;
  public totalQuestions: number = 9;
  public currentIndex: number = 0;

  public error: string = '';

  constructor(private route: ActivatedRoute,
              private router: Router,
              private sessionService: SessionService,
              private notification: NotificationService) {}

  ngOnInit(): void {
    this.sessionId = this.route.snapshot.paramMap.get('id') || '';
    if (!this.sessionId) {
      this.notification.error('Missing session identifier');
      this.router.navigate(['/']);
      return;
    }
    this.fetchNextQuestion();
  }

  fetchNextQuestion(): void {
    this.loading = true;
    this.error = '';
    this.sessionService.nextQuestion(this.sessionId).subscribe({
      next: (resp: any) => {
        this.loading = false;
        if (resp?.message && !resp.question_id) {
          // All questions answered: show the report
          this.router.navigate(['/report', this.sessionId]);
          return;
        }
        this.question        = resp;
        this.currentIndex    = resp.question_index;
        this.totalQuestions  = resp.total_questions || 9;
        this.progress        = Math.round((this.currentIndex / this.totalQuestions) * 100);
        this.answer          = '';
        this.attempts        = 1;
        this.questionStart   = Date.now();
        this.showFeedback    = false;
        this.lastFeedback    = null;
      },
      error: (err) => {
        this.loading = false;
        const msg = err?.error?.error || 'Unable to load the question';
        this.error = msg;
        this.notification.error(msg);
      }
    });
  }

  submitAnswer(): void {
    if (!this.answer.trim() || this.submitting) {
      return;
    }
    this.submitting = true;

    const elapsed = (Date.now() - this.questionStart) / 1000;

    const payload = {
      question_id:        this.question.question_id,
      answer:             this.answer.trim(),
      response_time_sec:  parseFloat(elapsed.toFixed(2)),
      attempts:           this.attempts
    };

    this.sessionService.submitAnswer(this.sessionId, payload).subscribe({
      next: (resp: any) => {
        this.submitting = false;
        const correct = !!resp.answer_correct;

        this.lastFeedback = {
          correct:   correct,
          partial:   resp.partial_score,
          predicted: resp.predicted_score,
          message:   correct ? 'Correct answer' : 'Incorrect answer'
        };
        this.showFeedback = true;

        if (!correct) {
          this.attempts += 1;
        }

        const isComplete = !!resp.session_complete;

        // Auto-advance 1.5s after showing feedback
        setTimeout(() => {
          if (isComplete) {
            this.router.navigate(['/report', this.sessionId]);
          } else {
            this.fetchNextQuestion();
          }
        }, 1500);
      },
      error: (err) => {
        this.submitting = false;
        const msg = err?.error?.error || 'Failed to submit the answer';
        this.notification.error(msg);
      }
    });
  }

  difficultyClass(): string {
    if (!this.question?.difficulty) return '';
    return 'diff-' + this.question.difficulty;
  }

  difficultyLabel(): string {
    const d = this.question?.difficulty;
    if (d === 'easy')   return 'Easy';
    if (d === 'medium') return 'Medium';
    if (d === 'hard')   return 'Hard';
    return d || '';
  }
}
