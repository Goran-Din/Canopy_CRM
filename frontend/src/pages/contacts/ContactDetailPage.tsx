import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Edit, Trash2, Mail, Phone, User, Calendar } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { PageHeader } from '@/components/shared/PageHeader';
import { StatusBadge } from '@/components/shared/StatusBadge';
import { ConfirmDialog } from '@/components/shared/ConfirmDialog';
import { ContactFormDialog } from './ContactFormDialog';
import { useApiGet, useApiMutation } from '@/hooks/useApi';
import { toast } from 'sonner';

interface Contact {
  id: string; customer_id: string; customer_display_name: string; property_id: string | null; property_name: string | null;
  contact_type: string; first_name: string; last_name: string; email: string | null; phone: string | null; mobile: string | null;
  job_title: string | null; is_primary: boolean; preferred_contact_method: string; notes: string | null; created_at: string;
}

export default function ContactDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [showEdit, setShowEdit] = useState(false);
  const [showDelete, setShowDelete] = useState(false);

  const { data: contact, isLoading } = useApiGet<Contact>(['contact', id], `/v1/contacts/${id}`, undefined, { enabled: !!id });
  const deleteMut = useApiMutation('delete', `/v1/contacts/${id}`, [['contacts']]);

  const handleDelete = () => {
    deleteMut.mutate(undefined as never, {
      onSuccess: () => { toast.success('Contact deleted'); navigate('/contacts'); },
      onError: (err) => toast.error(err.response?.data?.message ?? 'Failed to delete'),
    });
  };

  if (isLoading) return <div className="space-y-6"><Skeleton className="h-8 w-64" /><Skeleton className="h-48 w-full" /></div>;
  if (!contact) return <div className="text-center py-12"><p className="text-muted-foreground">Contact not found</p><Button variant="link" onClick={() => navigate('/contacts')}>Back to Contacts</Button></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate('/contacts')}><ArrowLeft className="h-4 w-4" /></Button>
        <PageHeader title={`${contact.first_name} ${contact.last_name}`} description={contact.job_title ?? contact.contact_type} actions={
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowEdit(true)}><Edit className="mr-2 h-4 w-4" />Edit</Button>
            <Button variant="destructive" size="icon" onClick={() => setShowDelete(true)}><Trash2 className="h-4 w-4" /></Button>
          </div>
        } />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Contact Details</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center gap-2"><StatusBadge status={contact.contact_type} />{contact.is_primary && <StatusBadge status="active" />}</div>
            {contact.email && <div className="flex items-start gap-3"><Mail className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Email</p><p className="text-sm">{contact.email}</p></div></div>}
            {contact.phone && <div className="flex items-start gap-3"><Phone className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Phone</p><p className="text-sm">{contact.phone}</p></div></div>}
            {contact.mobile && <div className="flex items-start gap-3"><Phone className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Mobile</p><p className="text-sm">{contact.mobile}</p></div></div>}
            <div className="flex items-start gap-3"><Calendar className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Created</p><p className="text-sm">{new Date(contact.created_at).toLocaleDateString()}</p></div></div>
            {contact.notes && <div className="pt-2 border-t"><p className="text-xs text-muted-foreground mb-1">Notes</p><p className="text-sm whitespace-pre-wrap">{contact.notes}</p></div>}
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Linked Records</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-3"><User className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Customer</p><Link to={`/customers/${contact.customer_id}`} className="text-sm text-primary hover:underline">{contact.customer_display_name}</Link></div></div>
            {contact.property_id && <div className="flex items-start gap-3"><User className="mt-0.5 h-4 w-4 text-muted-foreground" /><div><p className="text-xs text-muted-foreground">Property</p><Link to={`/properties/${contact.property_id}`} className="text-sm text-primary hover:underline">{contact.property_name ?? 'View Property'}</Link></div></div>}
          </CardContent>
        </Card>
      </div>

      <ContactFormDialog open={showEdit} onOpenChange={setShowEdit} contact={contact} />
      <ConfirmDialog open={showDelete} onOpenChange={setShowDelete} title="Delete Contact" description={`Delete "${contact.first_name} ${contact.last_name}"?`} confirmLabel="Delete" variant="destructive" loading={deleteMut.isPending} onConfirm={handleDelete} />
    </div>
  );
}
