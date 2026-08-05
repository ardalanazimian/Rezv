'use client';

// ═══════════════════════════════════════════════════════════════════════
//  ویرایشگرِ ردیف — کشویی که از روی تعریفِ فیلدها ساخته می‌شود
//
//  فقط فیلدهای تغییرکرده در PATCH فرستاده می‌شوند (نه کلِ آبجکت)، تا دو
//  ویرایشِ همزمانِ دو فیلدِ متفاوت همدیگر را پاک نکنند.
// ═══════════════════════════════════════════════════════════════════════

import { useEffect, useMemo, useRef, useState } from 'react';
import { Icon } from '../site/Icon';
import { studio, revalidateSite } from '@/lib/studio-api';
import { ApiError } from '@/lib/client-api';
import type { CollectionDef, FieldDef } from './fields';
import { emptyValue } from './fields';

type Values = Record<string, unknown>;

/** ISO → مقدارِ ورودیِ datetime-local (وقتِ محلیِ مرورگر). */
function toLocalInput(iso: unknown): string {
  if (typeof iso !== 'string' || !iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function fromLocalInput(v: string): string | null {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

function Field({
  field, value, onChange, error,
}: {
  field: FieldDef; value: unknown; onChange: (v: unknown) => void; error?: string;
}) {
  const id = `f-${field.key}`;
  const describedBy = [field.hint ? `${id}-hint` : '', error ? `${id}-err` : ''].filter(Boolean).join(' ') || undefined;

  const common = { id, 'aria-invalid': !!error, 'aria-describedby': describedBy };

  let control: React.ReactNode;

  switch (field.type) {
    case 'boolean':
      control = (
        <label className="row" style={{ gap: 'var(--sp-3)', cursor: 'pointer' }}>
          <input
            {...common}
            type="checkbox"
            checked={value === true}
            onChange={(e) => onChange(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: 'var(--brand)' }}
          />
          <span className="small">{value === true ? 'بله' : 'خیر'}</span>
        </label>
      );
      break;

    case 'select':
      control = (
        <select {...common} className="select" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}>
          {field.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
      );
      break;

    case 'number':
      control = (
        <input
          {...common} className="input input--ltr" inputMode="numeric"
          value={value === null || value === undefined ? '' : String(value)}
          onChange={(e) => {
            const raw = e.target.value.trim();
            onChange(raw === '' ? null : Number(raw.replace(/[^\d.-]/g, '')));
          }}
        />
      );
      break;

    case 'textarea':
      control = (
        <textarea {...common} className="textarea" value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} />
      );
      break;

    case 'markdown':
      control = (
        <textarea
          {...common} className="textarea" style={{ minHeight: '18rem', fontFamily: 'ui-monospace, monospace', fontSize: 'var(--fs-sm)' }}
          value={String(value ?? '')} onChange={(e) => onChange(e.target.value)}
        />
      );
      break;

    case 'tags':
    case 'list': {
      const arr = Array.isArray(value) ? (value as string[]) : [];
      control = (
        <textarea
          {...common} className="textarea"
          style={field.type === 'list' ? { minHeight: '9rem' } : undefined}
          value={arr.join('\n')}
          onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))}
          placeholder="هر خط یک مورد"
        />
      );
      break;
    }

    case 'json': {
      const text = value === null || value === undefined ? '' : JSON.stringify(value, null, 2);
      control = (
        <textarea
          {...common} className="textarea"
          style={{ minHeight: '20rem', fontFamily: 'ui-monospace, monospace', fontSize: 'var(--fs-xs)', direction: 'ltr', textAlign: 'left' }}
          defaultValue={text}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (!raw) { onChange(null); return; }
            try { onChange(JSON.parse(raw)); } catch { onChange({ __invalid: raw }); }
          }}
        />
      );
      break;
    }

    case 'datetime':
      control = (
        <input
          {...common} type="datetime-local" className="input input--ltr"
          value={toLocalInput(value)}
          onChange={(e) => onChange(fromLocalInput(e.target.value))}
        />
      );
      break;

    default:
      control = (
        <input
          {...common} className={field.type === 'slug' ? 'input input--ltr' : 'input'}
          value={String(value ?? '')} placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      );
  }

  return (
    <div className="field">
      <label className="label" htmlFor={id}>
        {field.label}
        {field.required && <span style={{ color: 'var(--danger)' }}> *</span>}
      </label>
      {control}
      {field.hint && <span className="tiny muted" id={`${id}-hint`}>{field.hint}</span>}
      {error && (
        <span className="field__error" id={`${id}-err`} role="alert">
          <Icon name="x" size={13} />{error}
        </span>
      )}
    </div>
  );
}

export function RecordEditor({
  collection,
  record,
  onClose,
  onSaved,
}: {
  collection: CollectionDef;
  record: Values | null;   // null = ردیفِ تازه
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = record === null;

  const initial = useMemo<Values>(() => {
    const out: Values = {};
    for (const f of collection.fields) {
      out[f.key] = isNew ? emptyValue(f) : (record as Values)[f.key] ?? emptyValue(f);
    }
    return out;
  }, [collection, record, isNew]);

  const [values, setValues] = useState<Values>(initial);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showSeo, setShowSeo] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; };
  }, [onClose]);

  const contentFields = collection.fields.filter((f) => f.group !== 'seo');
  const seoFields = collection.fields.filter((f) => f.group === 'seo');

  const set = (key: string) => (v: unknown) => {
    setValues((prev) => ({ ...prev, [key]: v }));
    if (error) setError(null);
  };

  /** بدنه‌ی ارسال: خالی‌ها حذف می‌شوند و در ویرایش فقط تغییرات می‌روند. */
  const buildPayload = (): Values | null => {
    const payload: Values = {};
    for (const f of collection.fields) {
      const v = values[f.key];

      if (v && typeof v === 'object' && '__invalid' in (v as object)) {
        setError(`مقدارِ «${f.label}» JSON معتبر نیست.`);
        return null;
      }
      if (f.required && (v === '' || v === null || v === undefined)) {
        setError(`«${f.label}» الزامی است.`);
        return null;
      }

      const isEmpty = v === '' || v === undefined || (Array.isArray(v) && v.length === 0 && isNew);
      if (isNew) {
        if (!isEmpty && v !== null) payload[f.key] = v;
      } else {
        const before = (record as Values)[f.key] ?? emptyValue(f);
        if (JSON.stringify(before ?? null) !== JSON.stringify(v ?? null)) {
          payload[f.key] = v === '' ? null : v;
        }
      }
    }
    if (!isNew && Object.keys(payload).length === 0) {
      setError('چیزی تغییر نکرده است.');
      return null;
    }
    return payload;
  };

  const save = async () => {
    const payload = buildPayload();
    if (!payload) return;
    setSaving(true);
    setError(null);
    try {
      if (isNew) await studio.post(`/api/v1/admin/site/${collection.key}`, payload);
      else await studio.patch(`/api/v1/admin/site/${collection.key}/${(record as Values).id}`, payload);
      // صفحه‌های سایت همان لحظه تازه شوند (نه در پایانِ بازه‌ی ISR).
      await revalidateSite();
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'ذخیره ناموفق بود.');
      setSaving(false);
    }
  };

  const remove = async () => {
    if (isNew) return;
    if (!window.confirm(`«${String((record as Values)[collection.titleField] ?? '')}» حذف شود؟ این کار برگشت‌پذیر نیست.`)) return;
    setSaving(true);
    try {
      await studio.del(`/api/v1/admin/site/${collection.key}/${(record as Values).id}`);
      await revalidateSite();
      onSaved();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : 'حذف ناموفق بود.');
      setSaving(false);
    }
  };

  return (
    <div
      className="studio-drawer"
      role="dialog"
      aria-modal="true"
      aria-label={isNew ? `افزودنِ ${collection.label}` : `ویرایشِ ${collection.label}`}
      onMouseDown={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="studio-drawer__panel" ref={panelRef}>
        <header className="studio-drawer__head">
          <h2 className="h4" style={{ flex: 1 }}>
            {isNew ? `افزودن به ${collection.label}` : `ویرایشِ ${collection.label}`}
          </h2>
          {!isNew && (
            <span className={`badge ${values.status === 'published' ? 'badge--success' : ''}`}>
              {values.status === 'published' ? 'منتشرشده' : 'پیش‌نویس'}
            </span>
          )}
          <button type="button" className="btn btn--quiet btn--sm" onClick={onClose} aria-label="بستن">
            <Icon name="x" size={18} />
          </button>
        </header>

        <div className="studio-drawer__body">
          {contentFields.map((f) => (
            <Field key={f.key} field={f} value={values[f.key]} onChange={set(f.key)} />
          ))}

          {seoFields.length > 0 && (
            <div className="card card--flat stack stack-4">
              <button
                type="button"
                className="row"
                style={{ background: 'none', border: 0, cursor: 'pointer', justifyContent: 'space-between', width: '100%', padding: 0 }}
                onClick={() => setShowSeo((v) => !v)}
                aria-expanded={showSeo}
              >
                <span className="row" style={{ gap: 'var(--sp-2)' }}>
                  <Icon name="seo" size={17} />
                  <b className="small">تنظیماتِ سئو</b>
                </span>
                <Icon name="chevronDown" size={17} style={{ transform: showSeo ? 'rotate(180deg)' : undefined }} />
              </button>
              {showSeo && (
                <div className="stack stack-5">
                  {seoFields.map((f) => (
                    <Field key={f.key} field={f} value={values[f.key]} onChange={set(f.key)} />
                  ))}
                </div>
              )}
            </div>
          )}

          {error && (
            <div className="notice notice--error" role="alert">
              <Icon name="x" size={18} />
              <span>{error}</span>
            </div>
          )}
        </div>

        <footer className="studio-drawer__foot">
          {!isNew && (
            <button type="button" className="btn btn--quiet btn--sm" onClick={remove} disabled={saving} style={{ marginInlineEnd: 'auto', color: 'var(--danger)' }}>
              حذف
            </button>
          )}
          <button type="button" className="btn btn--ghost" onClick={onClose} disabled={saving}>انصراف</button>
          <button type="button" className="btn btn--primary" onClick={save} disabled={saving}>
            {saving ? <><span className="spinner" />در حالِ ذخیره…</> : 'ذخیره'}
          </button>
        </footer>
      </div>
    </div>
  );
}
