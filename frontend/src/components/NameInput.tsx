import { useEffect, useId, useRef, useState } from "react";
import { searchPeople } from "../api";

type Props = { id?: string; value: string; onChange: (value: string) => void };

/** Name field that suggests saved names while the treasurer types. */
export default function NameInput({ id, value, onChange }: Props) {
  const listId = useId();
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(-1);
  const focused = useRef(false);

  useEffect(() => {
    if (!focused.current || value.trim() === "") {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    const timer = setTimeout(() => {
      searchPeople(value)
        .then((names) => {
          if (cancelled) return;
          setSuggestions(names.filter((n) => n.toLowerCase() !== value.trim().toLowerCase()));
          setActive(-1);
          setOpen(true);
        })
        .catch(() => !cancelled && setSuggestions([]));
    }, 120);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [value]);

  const choose = (name: string) => {
    onChange(name);
    setOpen(false);
    setSuggestions([]);
  };

  const showList = open && suggestions.length > 0;

  return (
    <div className="relative">
      <input
        id={id}
        className="field mt-1"
        role="combobox"
        aria-expanded={showList}
        aria-controls={listId}
        aria-autocomplete="list"
        aria-activedescendant={active >= 0 ? `${listId}-${active}` : undefined}
        autoComplete="off"
        value={value}
        placeholder="Start typing a name"
        onFocus={() => (focused.current = true)}
        onBlur={() => {
          focused.current = false;
          setOpen(false);
        }}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => {
          if (!showList) return;
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setActive((a) => (a + 1) % suggestions.length);
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setActive((a) => (a <= 0 ? suggestions.length - 1 : a - 1));
          } else if (e.key === "Enter" && active >= 0) {
            e.preventDefault();
            choose(suggestions[active]);
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {showList && (
        <ul
          id={listId}
          role="listbox"
          className="absolute z-10 mt-1 w-full overflow-hidden rounded-md border border-line bg-white shadow-lg"
        >
          {suggestions.map((name, i) => {
            const at = name.toLowerCase().indexOf(value.trim().toLowerCase());
            const len = value.trim().length;
            return (
              <li
                key={name}
                id={`${listId}-${i}`}
                role="option"
                aria-selected={i === active}
                // mouse down (not click) so the choice lands before the field loses focus
                onMouseDown={(e) => {
                  e.preventDefault();
                  choose(name);
                }}
                className={"cursor-pointer px-3 py-2 " + (i === active ? "bg-brand-tint" : "hover:bg-surface")}
              >
                {at >= 0 ? (
                  <>
                    {name.slice(0, at)}
                    <span className="font-semibold text-brand">{name.slice(at, at + len)}</span>
                    {name.slice(at + len)}
                  </>
                ) : (
                  name
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
