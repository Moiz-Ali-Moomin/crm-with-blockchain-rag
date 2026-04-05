import { redirect } from 'next/navigation';

// Contact creation is handled via the inline modal on the list page.
export default function NewContactPage() {
  redirect('/contacts');
}
