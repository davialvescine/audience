import { Badge } from '@/components/ui/Badge';
import { BrandHeader } from '@/components/ui/BrandHeader';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Input } from '@/components/ui/Input';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { Textarea } from '@/components/ui/Textarea';

export default function UiKitPage() {
  return (
    <div className="min-h-screen bg-surface">
      <BrandHeader title="UI Kit" subtitle="Showcase do design system" />
      <main className="max-w-3xl mx-auto py-8 px-6 space-y-8">
        <Card>
          <h2 className="text-xl font-display mb-4">Buttons</h2>
          <div className="flex flex-wrap gap-3">
            <Button>Primary</Button>
            <Button variant="accent">Accent</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="danger">Danger</Button>
            <Button loading>Loading</Button>
            <Button disabled>Disabled</Button>
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-display mb-4">Inputs</h2>
          <div className="space-y-4">
            <Input label="Nome" id="name" placeholder="João" />
            <Input label="Email" id="email" error="formato inválido" />
            <Textarea label="Comentário" id="c" maxLength={280} defaultValue="hello" />
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-display mb-4">Badges</h2>
          <div className="flex flex-wrap gap-2">
            <Badge status="pending" />
            <Badge status="approved" />
            <Badge status="rejected" />
            <Badge status="sent" />
            <Badge status="failed" />
          </div>
        </Card>

        <Card>
          <h2 className="text-xl font-display mb-4">EmptyState</h2>
          <EmptyState title="Nenhuma submissão" description="Quando alguém enviar, aparece aqui." />
        </Card>

        <Card>
          <h2 className="text-xl font-display mb-4">LoadingSkeleton</h2>
          <LoadingSkeleton lines={3} />
        </Card>
      </main>
    </div>
  );
}
