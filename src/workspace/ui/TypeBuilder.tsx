import { Menu } from "@base-ui/react/menu";
import {
  BracesIcon,
  ListFilterIcon,
  PlusIcon,
  RectangleEllipsisIcon,
  ShapesIcon,
  XIcon,
} from "lucide-react";
import type { ReactNode } from "react";

import { useCanvasStore } from "../../store/canvas";
import { FieldIcon, TypeIcon } from "../icons";
import type { FieldAtom } from "../model";
import {
  declarations,
  dependsOn,
  entriesOfTypes,
  isForNotes,
  TYPE_KEY,
  valueKind,
  type Entry,
  type GroupMode,
  type KeyId,
  type TypeExpr,
  type TypeId,
} from "../typeSystem";
import { Dropdown, type DropdownItem } from "./Dropdown";
import { FieldValueEditor } from "./FieldValueEditor";
import { POPUP_CLASS, POSITIONER_CLASS, usePopupContainer } from "./popups";

type Group = Extract<TypeExpr, { kind: "group" }>;

/** What every part of the builder needs to know: the type being edited. */
type BuilderProps = {
  /** Not offered under "is in" (nor are types that use it): a type can't include itself. */
  selfId: TypeId;
};

const GROUP_MODES: DropdownItem<GroupMode>[] = [
  { value: "all", label: "all" },
  { value: "any", label: "any" },
  { value: "none", label: "none" },
];

/**
 * Builds conditions on notes, read as a sentence: "Notes matching all of: is a Task, Status is any
 * of Open…". Groups are intersections (all), unions (any) and exclusions (none); each field
 * condition is a one-field shape.
 */
export function TypeBuilder({
  type,
  onChange,
  selfId,
}: BuilderProps & { type: Group; onChange: (type: Group) => void }) {
  return <GroupEditor group={type} onChange={onChange} selfId={selfId} />;
}

/** Named types a condition of type `selfId` may refer to (not itself, nor types using it). */
function useEligibleTypes(selfId: TypeId) {
  const types = useCanvasStore((s) => s.types);
  return types.filter((t) => t.id !== selfId && !dependsOn(t.expr, selfId, types));
}

/** A field condition: a shape with one entry that only constrains (declares nothing). */
type FieldCondition = { key: KeyId; optional: boolean; type: TypeExpr };

const asFieldCondition = (type: TypeExpr): FieldCondition | null =>
  type.kind === "shape" && type.entries.length === 1 && !type.entries[0]!.decl
    ? type.entries[0]!
    : null;

const fieldCondition = (entry: FieldCondition): TypeExpr => ({ kind: "shape", entries: [entry] });

/** "Is a Task": the note's `type` includes Task. */
const isAType = (type: TypeExpr): TypeId | null => {
  const condition = asFieldCondition(type);
  return condition?.key === TYPE_KEY && !condition.optional && condition.type.kind === "object"
    ? condition.type.id
    : null;
};

function GroupEditor({
  group,
  onChange,
  onRemove,
  selfId,
}: BuilderProps & {
  group: Group;
  onChange: (group: Group) => void;
  /** Unset for the top-level group. */
  onRemove?: () => void;
}) {
  const setChild = (index: number, child: TypeExpr) =>
    onChange({ ...group, of: group.of.map((c, i) => (i === index ? child : c)) });
  const removeChild = (index: number) =>
    onChange({ ...group, of: group.of.filter((_, i) => i !== index) });
  // In an "all" group, its "is a" conditions say which fields its notes have: offer those first.
  const typeIds = group.mode === "all" ? group.of.flatMap((c) => isAType(c) ?? []) : [];

  return (
    <div
      className={
        onRemove
          ? "flex flex-col gap-1 rounded border border-gray-200 bg-gray-50 p-1.5 pl-2"
          : "flex flex-col gap-1"
      }
    >
      <div className="flex items-center gap-1.5 text-xs text-gray-600">
        {onRemove ? "Matching" : "Notes matching"}
        <div className="w-20">
          <Dropdown
            label="Match"
            value={group.mode}
            onChange={(mode) => onChange({ ...group, mode })}
            items={GROUP_MODES}
          />
        </div>
        of:
        {onRemove && <RemoveButton label="Remove group" onClick={onRemove} />}
      </div>
      {group.of.length > 0 && (
        <ul className="flex flex-col gap-1 pl-3">
          {group.of.map((child, i) => (
            // Conditions have no IDs; their position is their identity while editing.
            // oxlint-disable-next-line react/no-array-index-key
            <li key={i}>
              <Condition
                type={child}
                onChange={(next) => setChild(i, next)}
                onRemove={() => removeChild(i)}
                typeIds={typeIds}
                selfId={selfId}
              />
            </li>
          ))}
        </ul>
      )}
      <AddCondition
        onAdd={(child) => onChange({ ...group, of: [...group.of, child] })}
        typeIds={typeIds}
        selfId={selfId}
      />
    </div>
  );
}

function Condition({
  type,
  onChange,
  onRemove,
  typeIds,
  selfId,
}: BuilderProps & {
  type: TypeExpr;
  onChange: (type: TypeExpr) => void;
  onRemove: () => void;
  /** Types the surrounding group requires: their fields are offered first. */
  typeIds: TypeId[];
}) {
  if (type.kind === "group") {
    return <GroupEditor group={type} onChange={onChange} onRemove={onRemove} selfId={selfId} />;
  }
  const isA = isAType(type);
  const field = asFieldCondition(type);
  let body: ReactNode;
  if (isA !== null) {
    body = (
      <>
        is a
        <TypePicker
          value={isA}
          onChange={(id) => onChange(fieldCondition({ ...field!, type: { kind: "object", id } }))}
          forNotes
          selfId={selfId}
        />
      </>
    );
  } else if (type.kind === "ref") {
    body = (
      <>
        is in
        <TypePicker
          value={type.typeId}
          onChange={(typeId) => onChange({ ...type, typeId })}
          selfId={selfId}
        />
      </>
    );
  } else if (field) {
    body = (
      <FieldConditionEditor
        condition={field}
        onChange={(next) => onChange(fieldCondition(next))}
        typeIds={typeIds}
        selfId={selfId}
      />
    );
  } else {
    body = <span className="py-1 text-gray-500">A condition the builder can't show</span>;
  }
  return (
    <div className="flex items-start gap-1.5">
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5 text-xs text-gray-600">
        {body}
      </div>
      <RemoveButton label="Remove condition" onClick={onRemove} />
    </div>
  );
}

function RemoveButton({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      className="ml-auto flex size-7 shrink-0 items-center justify-center rounded text-gray-500 hover:bg-gray-100"
    >
      <XIcon className="size-3.5" />
    </button>
  );
}

/** Picks a named type: any it may refer to, or (`forNotes`) those notes can be of. */
function TypePicker({
  value,
  onChange,
  forNotes = false,
  selfId,
}: BuilderProps & { value: TypeId; onChange: (id: TypeId) => void; forNotes?: boolean }) {
  const all = useCanvasStore((s) => s.types);
  const eligible = useEligibleTypes(selfId);
  const types = forNotes ? all.filter((t) => isForNotes(t, all)) : eligible;
  return (
    <div className="w-44">
      <Dropdown
        label={forNotes ? "Type" : "Type to be in"}
        value={value}
        placeholder="Deleted type"
        onChange={onChange}
        items={types.map((t) => ({
          value: t.id,
          label: t.name,
          icon: <TypeIcon typeId={t.id} className="size-3.5" />,
        }))}
      />
    </div>
  );
}

type ConditionKind = "oneOf" | "present" | "empty" | "inType";

const kindOf = ({ optional, type }: FieldCondition): ConditionKind | null => {
  if (optional) {
    return type.kind === "never" ? "empty" : null;
  }
  switch (type.kind) {
    case "unknown":
      return "present";
    case "ref":
      return "inType";
    case "object":
    case "literal":
      return "oneOf";
    case "group":
      return type.mode === "any" &&
        type.of.every((t) => t.kind === "object" || t.kind === "literal")
        ? "oneOf"
        : null;
    default:
      return null;
  }
};

/** How each kind of condition reads, for the field it's about. */
function conditionLabel(kind: ConditionKind, declared: Entry): string {
  switch (kind) {
    case "present":
      return "has a value";
    case "empty":
      return "is empty";
    case "inType":
      return "is in";
    case "oneOf": {
      const values = valueKind(declared.type);
      if (values.kind === "input") {
        return "is";
      }
      return values.many ? "includes any of" : "is any of";
    }
  }
}

/** The condition a field gets when it's first picked, or changes kind: no values yet. */
function blankCondition(
  key: KeyId,
  kind: ConditionKind,
  typeId: TypeId | undefined,
): FieldCondition {
  switch (kind) {
    case "empty":
      return { key, optional: true, type: { kind: "never" } };
    case "oneOf":
      return { key, optional: false, type: { kind: "group", mode: "any", of: [] } };
    case "inType":
      return typeId
        ? { key, optional: false, type: { kind: "ref", typeId } }
        : { key, optional: false, type: { kind: "unknown" } };
    case "present":
      return { key, optional: false, type: { kind: "unknown" } };
  }
}

/** The values a "one of" condition lists. */
const listedValues = (type: TypeExpr): FieldAtom[] => {
  if (type.kind === "object") {
    return [type.id];
  }
  if (type.kind === "literal") {
    return [type.value];
  }
  return type.kind === "group" ? type.of.flatMap(listedValues) : [];
};

/** Fields to pick from: those of `typeIds` first, then the rest. Same labels get their types. */
function useFieldItems(typeIds: TypeId[]): DropdownItem[] {
  const types = useCanvasStore((s) => s.types);
  const declared = [...declarations(types).values()];
  const own = new Set(entriesOfTypes(typeIds, types).map((e) => e.key));
  const label = (field: (typeof declared)[number]) => {
    const name = field.decl!.label;
    if (declared.filter((f) => f.decl!.label === name).length === 1) {
      return name;
    }
    return `${name} (${types.find((t) => t.id === field.typeId)?.name ?? "deleted type"})`;
  };
  const item = (field: (typeof declared)[number], group?: string): DropdownItem => ({
    value: field.key,
    label: label(field),
    icon: <FieldIcon entry={field} className="size-3.5" />,
    group,
  });
  if (own.size === 0) {
    return declared.map((f) => item(f));
  }
  return [
    ...declared.filter((f) => own.has(f.key)).map((f) => item(f, "Fields of these notes")),
    ...declared.filter((f) => !own.has(f.key)).map((f) => item(f, "Other fields")),
  ];
}

const valueBoxClass = "min-w-40 flex-1 rounded border border-gray-300 bg-white px-1 py-0.5";

function FieldConditionEditor({
  condition,
  onChange,
  typeIds,
  selfId,
}: BuilderProps & {
  condition: FieldCondition;
  onChange: (condition: FieldCondition) => void;
  typeIds: TypeId[];
}) {
  const types = useCanvasStore((s) => s.types);
  const declared = declarations(types).get(condition.key);
  const fieldItems = useFieldItems(typeIds);
  const eligible = useEligibleTypes(selfId);
  const kind = kindOf(condition);

  const values = declared ? valueKind(declared.type) : null;
  const kinds: ConditionKind[] = ["oneOf", "present", "empty"];
  if (values?.kind === "note" && eligible.length > 0) {
    kinds.push("inType");
  }
  // Checking for a value (or none) still applies to another field; listed values don't.
  const pickField = (key: KeyId) =>
    onChange(
      kind === "present" || kind === "empty"
        ? { ...condition, key }
        : blankCondition(key, "present", undefined),
    );

  let value: ReactNode = null;
  if (declared && kind === "oneOf") {
    // Several values can be listed, whatever the field holds: edit them as a list.
    const element = declared.type.kind === "array" ? declared.type.of : declared.type;
    const isObject = values?.kind === "note" || values?.kind === "type";
    value = (
      <div className={valueBoxClass}>
        <FieldValueEditor
          entry={{ ...declared, optional: true, type: { kind: "array", of: element } }}
          value={listedValues(condition.type)}
          onChange={(atoms) =>
            onChange({
              ...condition,
              type: {
                kind: "group",
                mode: "any",
                of: atoms.map((v) =>
                  isObject ? { kind: "object", id: String(v) } : { kind: "literal", value: v },
                ),
              },
            })
          }
          inSettings
        />
      </div>
    );
  } else if (kind === "inType" && condition.type.kind === "ref") {
    const ref = condition.type;
    value = (
      <TypePicker
        value={ref.typeId}
        onChange={(typeId) => onChange({ ...condition, type: { ...ref, typeId } })}
        selfId={selfId}
      />
    );
  }

  return (
    <>
      <div className="w-40">
        <Dropdown
          label="Field"
          value={declared ? condition.key : null}
          placeholder="Deleted field"
          onChange={pickField}
          items={fieldItems}
        />
      </div>
      {declared && kind && (
        <div className="w-36">
          <Dropdown
            label="Condition"
            value={kind}
            onChange={(next) => onChange(blankCondition(condition.key, next, eligible[0]?.id))}
            items={kinds.map((k) => ({ value: k, label: conditionLabel(k, declared) }))}
          />
        </div>
      )}
      {value}
    </>
  );
}

const menuItemClass =
  "flex cursor-pointer items-center gap-2 py-1.5 pr-3 pl-2 text-sm outline-none select-none data-highlighted:bg-gray-100";

/** "Add condition": is a type, a field, is in a type, or a nested group. */
function AddCondition({
  onAdd,
  typeIds,
  selfId,
}: BuilderProps & { onAdd: (type: TypeExpr) => void; typeIds: TypeId[] }) {
  const container = usePopupContainer();
  const types = useCanvasStore((s) => s.types);
  const fieldItems = useFieldItems(typeIds);
  const eligible = useEligibleTypes(selfId);
  const forNotes = types.find((t) => !t.builtIn && isForNotes(t, types));

  const options: { label: string; icon: ReactNode; make: () => TypeExpr }[] = [];
  if (forNotes) {
    options.push({
      label: "Is a…",
      icon: <ShapesIcon className="size-3.5 text-gray-500" />,
      make: () =>
        fieldCondition({
          key: TYPE_KEY,
          optional: false,
          type: { kind: "object", id: forNotes.id },
        }),
    });
  }
  if (fieldItems[0]) {
    const key = fieldItems[0].value;
    options.push({
      label: "Field…",
      icon: <RectangleEllipsisIcon className="size-3.5 text-gray-500" />,
      make: () => fieldCondition(blankCondition(key, "present", undefined)),
    });
  }
  if (eligible[0]) {
    const typeId = eligible[0].id;
    options.push({
      label: "Is in…",
      icon: <ListFilterIcon className="size-3.5 text-gray-500" />,
      make: () => ({ kind: "ref", typeId }),
    });
  }
  options.push({
    label: "Group",
    icon: <BracesIcon className="size-3.5 text-gray-500" />,
    make: () => ({ kind: "group", mode: "any", of: [] }),
  });

  return (
    <Menu.Root>
      <Menu.Trigger className="-ml-1.5 flex h-6 items-center gap-1 self-start rounded px-1.5 text-xs text-gray-600 hover:bg-gray-100 data-popup-open:bg-gray-100">
        <PlusIcon className="size-3.5" />
        Add condition
      </Menu.Trigger>
      <Menu.Portal container={container}>
        <Menu.Positioner sideOffset={4} align="start" className={POSITIONER_CLASS}>
          <Menu.Popup className={`min-w-44 py-1 ${POPUP_CLASS}`}>
            {options.map((option) => (
              <Menu.Item
                key={option.label}
                onClick={() => onAdd(option.make())}
                className={menuItemClass}
              >
                {option.icon}
                {option.label}
              </Menu.Item>
            ))}
          </Menu.Popup>
        </Menu.Positioner>
      </Menu.Portal>
    </Menu.Root>
  );
}
