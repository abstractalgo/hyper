import { Select } from "@base-ui/react/select";
import { CheckIcon, ChevronsUpDownIcon } from "lucide-react";
import { Fragment, type ReactNode } from "react";

import { POPUP_CLASS, POSITIONER_CLASS, usePopupContainer } from "./popups";

export type DropdownItem<V extends string = string> = {
  value: V;
  label: string;
  icon?: ReactNode;
  /** Items with the same group are listed together under that heading (in first-seen order). */
  group?: string;
};

type DropdownProps<V extends string> = {
  /** Selected item's value; null shows the placeholder. */
  value: V | null;
  onChange: (value: V) => void;
  items: DropdownItem<V>[];
  label: string;
  placeholder?: string;
  disabled?: boolean;
  className?: string;
};

/** Groups consecutive-or-not items by their `group`, keeping the order groups first appear in. */
function groupItems<V extends string>(items: DropdownItem<V>[]) {
  const groups: { name: string | undefined; items: DropdownItem<V>[] }[] = [];
  for (const item of items) {
    const group = groups.find((g) => g.name === item.group);
    if (group) group.items.push(item);
    else groups.push({ name: item.group, items: [item] });
  }
  return groups;
}

/** A styled replacement for a native `<select>` (Base UI Select), with optional icons and groups. */
export function Dropdown<V extends string>({
  value,
  onChange,
  items,
  label,
  placeholder = "Choose…",
  disabled = false,
  className = "",
}: DropdownProps<V>) {
  const container = usePopupContainer();
  const byValue = new Map(items.map((item) => [item.value, item]));

  return (
    <Select.Root
      value={value}
      onValueChange={(next) => {
        if (next !== null) onChange(next);
      }}
      disabled={disabled}
    >
      <Select.Trigger
        aria-label={label}
        className={`flex h-8 w-full min-w-0 items-center justify-between gap-2 rounded border border-gray-300 bg-white px-2 text-left text-sm outline-none hover:bg-gray-50 focus-visible:border-blue-500 data-disabled:cursor-not-allowed data-disabled:bg-gray-50 data-disabled:text-gray-500 ${className}`}
      >
        <Select.Value placeholder={<span className="text-gray-500">{placeholder}</span>}>
          {(selected: V | null) => {
            const item = selected === null ? undefined : byValue.get(selected);
            return item ? (
              <span className="flex min-w-0 items-center gap-2">
                {item.icon}
                <span className="truncate">{item.label}</span>
              </span>
            ) : (
              <span className="text-gray-500">{placeholder}</span>
            );
          }}
        </Select.Value>
        <Select.Icon className="shrink-0 text-gray-400">
          <ChevronsUpDownIcon className="size-3.5" />
        </Select.Icon>
      </Select.Trigger>
      <Select.Portal container={container}>
        <Select.Positioner
          sideOffset={4}
          align="start"
          alignItemWithTrigger={false}
          className={POSITIONER_CLASS}
        >
          <Select.Popup
            className={`max-h-[var(--available-height)] min-w-[var(--anchor-width)] overflow-y-auto py-1 ${POPUP_CLASS}`}
          >
            <Select.List>
              {groupItems(items).map((group, i) => (
                <Fragment key={group.name ?? `group-${i}`}>
                  {i > 0 && <Select.Separator className="my-1 h-px bg-gray-200" />}
                  <Select.Group>
                    {group.name && (
                      <Select.GroupLabel className="px-3 pt-1.5 pb-1 text-xs text-gray-500">
                        {group.name}
                      </Select.GroupLabel>
                    )}
                    {group.items.map((item) => (
                      <Select.Item
                        key={item.value}
                        value={item.value}
                        className="grid cursor-pointer grid-cols-[1rem_1fr] items-center gap-2 py-1.5 pr-3 pl-2 text-sm outline-none select-none data-highlighted:bg-gray-100"
                      >
                        <Select.ItemIndicator className="col-start-1">
                          <CheckIcon className="size-3.5" />
                        </Select.ItemIndicator>
                        <span className="col-start-2 flex min-w-0 items-center gap-2">
                          {item.icon}
                          <Select.ItemText className="truncate">{item.label}</Select.ItemText>
                        </span>
                      </Select.Item>
                    ))}
                  </Select.Group>
                </Fragment>
              ))}
            </Select.List>
          </Select.Popup>
        </Select.Positioner>
      </Select.Portal>
    </Select.Root>
  );
}
