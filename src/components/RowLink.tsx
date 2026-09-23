"use client";

import { useRouter } from "next/navigation";

/** Table row that navigates on click, like the reference's clickable breakdown rows. */
export default function RowLink({
  href,
  className,
  children,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <tr className={"cursor-pointer " + (className ?? "")} onClick={() => router.push(href)}>
      {children}
    </tr>
  );
}
