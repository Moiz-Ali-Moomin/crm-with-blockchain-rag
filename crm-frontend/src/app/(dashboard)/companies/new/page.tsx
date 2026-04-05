import { redirect } from 'next/navigation';

// Company creation is handled via the inline modal on the list page.
export default function NewCompanyPage() {
  redirect('/companies');
}
