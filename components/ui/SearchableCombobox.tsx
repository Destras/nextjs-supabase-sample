'use client'

import * as React from 'react'
import { Check, ChevronsUpDown } from 'lucide-react'

import { cn } from '@/lib/utils'
import { normalizeForSearch } from '@/lib/normalizeForSearch'
import { Button } from '@/components/ui/button'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover'

export interface ComboboxOption {
  value: string
  label: string
}

interface SearchableComboboxProps {
  /** Full list of options */
  items: ReadonlyArray<ComboboxOption>
  /** Currently selected value, or null if nothing is selected */
  value: string | null
  /** Called with the selected value, or null when the user picks "Sin asignar" */
  onChange: (value: string | null) => void
  /** Placeholder text shown when nothing is selected */
  placeholder?: string
  /** Optional leading icon rendered inside the trigger (left side) */
  icon?: React.ReactNode
  /** Accessible label for the trigger button */
  ariaLabel?: string
  /** Extra classes for the trigger button */
  triggerClassName?: string
  /**
   * Whether to offer the "Sin asignar" clear option (calls onChange(null)).
   * Defaults to true. Set false when a selection is mandatory (e.g. the patient
   * selector, whose onChange ignores null — the clear option would be inert).
   */
  allowClear?: boolean
  /** Disables the trigger (real `disabled`, not just visual). */
  disabled?: boolean
}

/**
 * SearchableCombobox — a Popover + Command combobox that replaces native <Select>
 * elements across the Asignar-Contenido view.
 *
 * Design contract (from asignar-contenido.pages-5.jsx · .wk-sel):
 *   - bg-background surface, border-border, text-[13px]
 *   - Leading icon on the left (brand-colored, supplied by caller)
 *   - Text truncated to the fixed column width (full name in `title`)
   - Dropdown wider than a narrow trigger; long options wrap instead of truncating
 *   - Options rendered on-demand (only when the Popover is open)
 *     → mitigates "Performance.measure: Given attribute end cannot be negative"
 *       which was hypothesised to stem from mounting hundreds of SelectItems at once.
 *       If the error persists after this change, a dedicated debug session is needed.
 */
const SearchableCombobox = ({
  items,
  value,
  onChange,
  placeholder = 'Sin asignar',
  icon,
  ariaLabel,
  triggerClassName,
  allowClear = true,
  disabled = false,
}: SearchableComboboxProps): React.JSX.Element => {
  const [open, setOpen] = React.useState(false)

  const selectedLabel = React.useMemo(() => {
    if (value == null) return null
    return items.find((item) => item.value === value)?.label ?? null
  }, [items, value])

  // Precompute each label's normalized form once per `items` change so the
  // filter doesn't re-run NFD-normalize over every option on every keystroke.
  const normalizedByLabel = React.useMemo(() => {
    const m = new Map<string, string>()
    for (const item of items) m.set(item.label, normalizeForSearch(item.label))
    return m
  }, [items])

  // Accent/case-insensitive filter for cmdk: matches the typed search against
  // each item's label (passed via `keywords`), not its uuid `value`.
  const filter = React.useCallback(
    (_value: string, search: string, keywords?: string[]): number => {
      const needle = normalizeForSearch(search)
      if (needle === '') return 1
      const label = keywords?.[0]
      if (label == null) return 0
      const haystack = normalizedByLabel.get(label) ?? normalizeForSearch(label)
      return haystack.includes(needle) ? 1 : 0
    },
    [normalizedByLabel],
  )

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          aria-label={ariaLabel}
          // Full name on hover: the label truncates to the trigger width.
          title={selectedLabel ?? undefined}
          className={cn(
            // .wk-sel look. Layout is strictly in-flow (icon → label → chevron):
            // an absolute icon + left-padding hack is defeated by shadcn Button's
            // has-[>svg]:px-3 (the chevron is an svg child), which shrinks the
            // padding and lets the icon overlap the text. In-flow + min-w-0 on the
            // label makes the icon never overlap and the text truncate cleanly.
            'flex w-full items-center justify-start gap-2 bg-background text-[13px] font-normal',
            'border-border',
            !selectedLabel && 'text-muted-foreground',
            triggerClassName,
          )}
        >
          {/* Leading icon — in-flow, never overlaps the text */}
          {icon != null && (
            <span className="pointer-events-none flex shrink-0">{icon}</span>
          )}

          {/* Selected label or placeholder — truncates within the column */}
          <span className="min-w-0 flex-1 truncate text-left">
            {selectedLabel ?? placeholder}
          </span>

          <ChevronsUpDown className="shrink-0 opacity-50" size={14} />
        </Button>
      </PopoverTrigger>

      {/*
       * Options are only mounted when the Popover is open (Radix Portal).
       * This is the core mitigation for the DOM-size issue (issue 8).
       */}
      <PopoverContent
        className="p-0"
        align="start"
        // At least as wide as the trigger, but never narrower than 18rem: in a
        // narrow grid column the trigger is ~150px and the options were cut off.
        style={{ width: 'max(var(--radix-popover-trigger-width), 18rem)' }}
      >
        <Command filter={filter}>
          <CommandInput placeholder="Buscar…" className="text-[13px]" />
          <CommandList>
            <CommandEmpty className="text-[13px]">Sin resultados</CommandEmpty>
            <CommandGroup>
              {/* "Sin asignar" clear option — omitted when a selection is mandatory */}
              {allowClear && (
                <CommandItem
                  value=""
                  onSelect={() => {
                    onChange(null)
                    setOpen(false)
                  }}
                  className="text-[13px] text-muted-foreground"
                >
                  <Check
                    className={cn(
                      'mr-2 shrink-0',
                      value == null ? 'opacity-100' : 'opacity-0',
                    )}
                    size={14}
                  />
                  Sin asignar
                </CommandItem>
              )}

              {items.map((item) => (
                <CommandItem
                  key={item.value}
                  value={item.value}
                  keywords={[item.label]}
                  onSelect={() => {
                    onChange(item.value)
                    setOpen(false)
                  }}
                  className="text-[13px]"
                >
                  <Check
                    className={cn(
                      'mr-2 shrink-0',
                      value === item.value ? 'opacity-100' : 'opacity-0',
                    )}
                    size={14}
                  />
                  <span className="min-w-0 whitespace-normal break-words">
                    {item.label}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  )
}

export { SearchableCombobox }
export type { SearchableComboboxProps }
