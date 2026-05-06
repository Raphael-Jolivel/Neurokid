export class Question {
  public question_index!:  number;
  public total_questions!: number;
  public question_id!:     number;
  public domain!:          string;
  public difficulty!:      string;
  public question!:        string;
}

export class AnswerResult {
  public question_index!:   number;
  public domain!:           string;
  public difficulty!:       string;
  public answer_correct!:   number;
  public partial_score!:    number;
  public predicted_score!:  number;
  public session_complete!: boolean;
}

export class DomainScore {
  public average_score!: number;
  public level!:         string;
}

export class AnswerDetail {
  public domain!:            string;
  public difficulty!:        string;
  public raw_answer!:        string;
  public answer_correct!:    number;
  public partial_score!:     number;
  public response_time_sec!: number;
  public predicted_score!:   number;
}

export class SessionReport {
  public session_id!:               string;
  public child_name!:               string;
  public age!:                      number;
  public overall_cognitive_score!:  number;
  public overall_level!:            string;
  public domain_breakdown!:         { [k: string]: DomainScore };
  public answer_details!:           AnswerDetail[];
}
