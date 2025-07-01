export interface EmailEvent {
  to: string;
  subject: string;
  html: string;
  text: string;
  type: 'verification' | 'resetPassword';
}