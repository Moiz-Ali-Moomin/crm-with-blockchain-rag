import { redirect } from 'next/navigation';

// Lead creation is handled via the inline modal on the list page.
export default function NewLeadPage() {
  redirect('/leads');
}
