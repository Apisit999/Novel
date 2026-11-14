export function SearchForm({
  defaultValue = "",
  autoFocus = false,
}: {
  defaultValue?: string;
  autoFocus?: boolean;
}) {
  return (
    <form action="/search" role="search" className="flex w-full">
      <label htmlFor="q" className="sr-only">
        ค้นหาเรื่อง
      </label>
      <input
        id="q"
        name="q"
        type="search"
        defaultValue={defaultValue}
        autoFocus={autoFocus}
        placeholder="ค้นหาชื่อเรื่อง หรือแท็ก"
        className="border-accent bg-surface text-foreground min-h-14 min-w-0 flex-1 rounded-l-full border-2 border-r-0 px-5"
      />
      <button
        type="submit"
        className="bg-accent text-accent-foreground min-h-14 cursor-pointer rounded-r-full px-6 font-bold sm:px-8"
      >
        ค้นหา
      </button>
    </form>
  );
}
