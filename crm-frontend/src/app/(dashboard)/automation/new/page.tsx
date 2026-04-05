import { redirect } from 'next/navigation';

// Workflow creation is handled on the automation list page.
export default function NewAutomationPage() {
  redirect('/automation');
}
