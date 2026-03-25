import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { base44 } from '@/api/base44Client';
import { ArrowLeft, Loader2, CheckCircle, Camera, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from '@/components/ui/select';
import confetti from 'canvas-confetti';
import PageHeader from '@/components/shared/PageHeader';
import { useTenant } from '@/lib/TenantContext';

export default function VehicleAdd() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { fleets, tenant } = useTenant() || {};
  const [photo, setPhoto] = useState(null);
  const [generatingAI, setGeneratingAI] = useState(false);
  const [form, setForm] = useState({
    license_plate: '',
    fleet: '',
    owner_name: '',
    make: '',
    model: '',
    year: '',
    color: '',
    status: 'available',
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      let photoUrl = '';
      if (photo) {
        const uploaded = await base44.integrations.Core.UploadFile({ file: photo });
        photoUrl = uploaded.file_url;
      } else if (form.make && form.model) {
        // Auto-generate AI illustration
        setGeneratingAI(true);
        const prompt = `Clean modern flat design illustration of a ${form.year || ''} ${form.make} ${form.model} in ${form.color || 'white'} color. Professional app UI style like Uber or Tesla — stylized but realistic vehicle illustration, slight 3/4 front angle, minimal background, no text, no shadows, premium quality. The car color should clearly be ${form.color || 'white'}.`;
        const result = await base44.integrations.Core.GenerateImage({ prompt });
        photoUrl = result.url;
        setGeneratingAI(false);
      }
      await base44.entities.Vehicle.create({
        ...form,
        year: parseInt(form.year) || 0,
        photo_url: photoUrl,
        tenant_id: tenant?.id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['vehicles'] });
      confetti({ particleCount: 60, spread: 50, origin: { y: 0.6 } });
      setTimeout(() => navigate('/'), 600);
    },
  });

  const set = (k, v) => setForm(p => ({ ...p, [k]: v }));

  return (
    <div>
      <PageHeader emoji="🚗" title="Add Vehicle"
        action={<Button variant="ghost" onClick={() => navigate(-1)} className="rounded-xl"><ArrowLeft className="w-4 h-4 mr-1" /> Back</Button>}
      />
      <div className="px-4 space-y-3">
        {/* Photo upload */}
        <div className="border-2 border-dashed border-primary/30 rounded-2xl p-4 text-center bg-primary/5">
          <input type="file" id="vehicle-photo" accept="image/*" onChange={e => setPhoto(e.target.files[0])} className="hidden" />
          <label htmlFor="vehicle-photo" className="cursor-pointer flex flex-col items-center gap-1">
            <Camera className="w-8 h-8 text-primary/50" />
            <p className="font-bold text-sm">{photo ? photo.name : 'Upload Your Own Photo'}</p>
            <p className="text-xs text-muted-foreground">Optional — AI will auto-generate if skipped</p>
          </label>
        </div>
        {!photo && form.make && form.model && (
          <div className="bg-primary/5 border border-primary/20 rounded-2xl px-3 py-2.5 flex items-center gap-2 text-xs font-bold text-primary">
            <Sparkles className="w-4 h-4 flex-shrink-0" />
            AI will generate a {form.color || ''} {form.year || ''} {form.make} {form.model} illustration
          </div>
        )}

        <Field label="License Plate">
          <Input className="rounded-xl h-12 font-bold text-lg uppercase" value={form.license_plate} onChange={e => set('license_plate', e.target.value.toUpperCase())} placeholder="ABC 1234" />
        </Field>
        <Field label="Fleet">
          <Select value={form.fleet} onValueChange={v => set('fleet', v)}>
            <SelectTrigger className="rounded-xl h-12"><SelectValue placeholder="Select fleet..." /></SelectTrigger>
            <SelectContent>
              {(fleets || []).map(f => (
                <SelectItem key={f.id} value={f.id}>🚘 {f.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
        <Field label="Owner Name">
          <Input className="rounded-xl h-12" value={form.owner_name} onChange={e => set('owner_name', e.target.value)} placeholder="Owner name" />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Make"><Input className="rounded-xl h-12" value={form.make} onChange={e => set('make', e.target.value)} placeholder="Toyota" /></Field>
          <Field label="Model"><Input className="rounded-xl h-12" value={form.model} onChange={e => set('model', e.target.value)} placeholder="Camry" /></Field>
          <Field label="Year"><Input type="number" className="rounded-xl h-12" value={form.year} onChange={e => set('year', e.target.value)} placeholder="2024" /></Field>
        </div>
        <Field label="Color">
          <Input className="rounded-xl h-12" value={form.color} onChange={e => set('color', e.target.value)} placeholder="White" />
        </Field>

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}
          className="w-full h-14 rounded-2xl font-bold text-lg gap-2 bg-primary text-primary-foreground shadow-lg mt-2">
          {saveMutation.isPending
            ? <><Loader2 className="w-5 h-5 animate-spin" /> {generatingAI ? 'Generating AI Image...' : 'Saving...'}</>
            : <><CheckCircle className="w-5 h-5" /> Save Vehicle</>}
        </Button>
        <div className="h-4" />
      </div>
    </div>
  );
}

function Field({ label, children }) {
  return (
    <div>
      <Label className="text-xs font-bold text-muted-foreground mb-1 block">{label}</Label>
      {children}
    </div>
  );
}