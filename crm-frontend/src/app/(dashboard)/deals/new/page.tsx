import { redirect } from 'next/navigation';

// Deal creation is handled via the inline modal on the list page.
export default function NewDealPage() {
  redirect('/deals');
}
