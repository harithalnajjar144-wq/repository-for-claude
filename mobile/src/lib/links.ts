import type { Href } from "expo-router";

/** Notifications carry website paths; map them to app screens. */
export function appRouteFor(link: string | null | undefined): Href {
  if (!link) return "/account/notifications";
  const [path, query = ""] = link.split("?");
  let m: RegExpExecArray | null;
  if ((m = /^\/auctions\/(\d+)/.exec(path))) return { pathname: "/auction/[id]", params: { id: m[1] } };
  if ((m = /^\/listings\/(\d+)/.exec(path))) return { pathname: "/listing/[id]", params: { id: m[1] } };
  if ((m = /^\/(vets|shops)\/(\d+)/.exec(path))) return { pathname: "/provider/[id]", params: { id: m[2] } };
  if (path === "/dashboard/business") return query.includes("orders") ? "/business/orders" : query.includes("bookings") ? "/business/bookings" : "/business";
  if (path === "/dashboard/bookings") return "/account/bookings";
  if (path === "/dashboard/orders") return "/account/orders";
  if (path === "/dashboard/wallet") return "/account/wallet";
  if (path.startsWith("/dashboard/profile")) return "/account/verification";
  return "/account/notifications";
}
