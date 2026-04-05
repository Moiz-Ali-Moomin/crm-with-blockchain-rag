import { redirect } from 'next/navigation';

// Ticket creation is handled via the inline modal on the list page.
export default function NewTicketPage() {
  redirect('/tickets');
}
