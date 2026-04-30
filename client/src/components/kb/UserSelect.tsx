import * as React from "react";
import { Check, ChevronsUpDown } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { cn } from "@/lib/utils";

export interface UserSelectOption {
  id: string;
  displayName: string;
}

interface UserSelectProps {
  options: UserSelectOption[];
  value: string | undefined;
  onValueChange: (val: string | undefined) => void;
  placeholder?: string;
  allowNone?: boolean;
  className?: string;
  triggerClassName?: string;
  "data-testid"?: string;
}

export function UserSelect({
  options,
  value,
  onValueChange,
  placeholder = "Выберите пользователя…",
  allowNone = false,
  triggerClassName,
  "data-testid": testId,
}: UserSelectProps) {
  const [open, setOpen] = React.useState(false);

  const selected = options.find((u) => u.id === value);
  const displayLabel = selected?.displayName ?? (allowNone && !value ? "Не выбран" : placeholder);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          data-testid={testId}
          className={cn(
            "mt-1 w-full justify-between rounded-xl font-normal",
            !selected && "text-muted-foreground",
            triggerClassName,
          )}
        >
          <span className="truncate">{displayLabel}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
        <Command>
          <CommandInput placeholder="Поиск…" data-testid={testId ? `${testId}-search` : undefined} />
          <CommandList>
            <CommandEmpty>Пользователи не найдены</CommandEmpty>
            <CommandGroup>
              {allowNone && (
                <CommandItem
                  value="__none__"
                  onSelect={() => {
                    onValueChange(undefined);
                    setOpen(false);
                  }}
                  data-testid={testId ? `${testId}-option-none` : undefined}
                >
                  <Check className={cn("mr-2 h-4 w-4", !value ? "opacity-100" : "opacity-0")} />
                  Не выбран
                </CommandItem>
              )}
              {options.map((u) => (
                <CommandItem
                  key={u.id}
                  value={u.displayName}
                  onSelect={() => {
                    onValueChange(u.id);
                    setOpen(false);
                  }}
                  data-testid={testId ? `${testId}-option-${u.id}` : undefined}
                >
                  <Check className={cn("mr-2 h-4 w-4", value === u.id ? "opacity-100" : "opacity-0")} />
                  {u.displayName}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
