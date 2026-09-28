// sidebar.tsx — Sidebar colapsable estilo Aceternity (hover-expand en desktop,
// drawer con hamburguesa en móvil). Adaptado a este codebase:
// - react-router-dom (NavLink) en lugar de next/link
// - tokens del tema del app (var(--surface), var(--bg), …) en lugar de neutrales fijos
// - SidebarLink acepta end/onClick/right/accent y estado activo con la pill del app
import { cn } from "@/lib/utils";
import React, { useState, createContext, useContext } from "react";
import { NavLink } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Menu, X } from "lucide-react";

interface Links {
  label: string;
  href: string;
  icon: React.JSX.Element | React.ReactNode;
  hint?: string;
}

interface SidebarContextProps {
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  animate: boolean;
}

const SidebarContext = createContext<SidebarContextProps | undefined>(
  undefined
);

export const useSidebar = () => {
  const context = useContext(SidebarContext);
  if (!context) {
    throw new Error("useSidebar must be used within a SidebarProvider");
  }
  return context;
};

export const SidebarProvider = ({
  children,
  open: openProp,
  setOpen: setOpenProp,
  animate = true,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  const [openState, setOpenState] = useState(false);

  const open = openProp !== undefined ? openProp : openState;
  const setOpen = setOpenProp !== undefined ? setOpenProp : setOpenState;

  return (
    <SidebarContext.Provider value={{ open, setOpen, animate }}>
      {children}
    </SidebarContext.Provider>
  );
};

export const Sidebar = ({
  children,
  open,
  setOpen,
  animate,
}: {
  children: React.ReactNode;
  open?: boolean;
  setOpen?: React.Dispatch<React.SetStateAction<boolean>>;
  animate?: boolean;
}) => {
  return (
    <SidebarProvider open={open} setOpen={setOpen} animate={animate}>
      {children}
    </SidebarProvider>
  );
};

export const SidebarBody = ({
  mobile = true,
  ...props
}: React.ComponentProps<typeof motion.div> & { mobile?: boolean }) => {
  return (
    <>
      <DesktopSidebar {...props} />
      {mobile && <MobileSidebar {...(props as React.ComponentProps<"div">)} />}
    </>
  );
};

export const DesktopSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<typeof motion.div>) => {
  const { open, setOpen, animate } = useSidebar();
  return (
    <motion.div
      className={cn(
        "h-full px-2 py-4 hidden md:flex md:flex-col bg-[var(--surface)] border-r border-[var(--border-soft)] w-[300px] flex-shrink-0 overflow-hidden",
        className
      )}
      animate={{
        width: animate ? (open ? "300px" : "60px") : "300px",
      }}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      {...props}
    >
      {children}
    </motion.div>
  );
};

export const MobileSidebar = ({
  className,
  children,
  ...props
}: React.ComponentProps<"div">) => {
  const { open, setOpen } = useSidebar();
  return (
    <>
      <div
        className={cn(
          "h-10 px-4 py-4 flex flex-row md:hidden items-center justify-between bg-[var(--surface)] w-full border-b border-[var(--border-soft)]"
        )}
        {...props}
      >
        <div className="flex justify-end z-20 w-full">
          <Menu
            className="text-[var(--text)] cursor-pointer"
            onClick={() => setOpen(!open)}
          />
        </div>
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ x: "-100%", opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: "-100%", opacity: 0 }}
              transition={{
                duration: 0.3,
                ease: "easeInOut",
              }}
              className={cn(
                "fixed h-full w-full inset-0 bg-[var(--bg)] p-10 z-[100] flex flex-col justify-between",
                className
              )}
            >
              <div
                className="absolute right-10 top-10 z-50 text-[var(--text)] cursor-pointer"
                onClick={() => setOpen(!open)}
              >
                <X />
              </div>
              {children}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </>
  );
};

export const SidebarLink = ({
  link,
  className,
  end,
  onClick,
  right,
  accent,
}: {
  link: Links;
  className?: string;
  end?: boolean;
  onClick?: () => void;
  right?: React.ReactNode;
  accent?: boolean;
}) => {
  const { open, animate } = useSidebar();
  return (
    <NavLink
      to={link.href}
      end={end}
      onClick={onClick}
      title={link.hint}
      className="group/sidebar block rounded-[10px] hover:bg-[color-mix(in_oklab,var(--text)_5%,transparent)] transition-colors"
    >
      {({ isActive }) => (
        <span
          className={cn(
            "relative flex items-center gap-[11px] px-3 py-[9px] overflow-hidden",
            className
          )}
          style={{
            fontSize: 13.5,
            fontWeight: isActive ? 700 : 500,
            color: isActive ? "var(--text)" : "var(--text-2)",
            background: isActive
              ? "color-mix(in oklab, var(--primary) 14%, transparent)"
              : undefined,
            boxShadow: isActive
              ? "inset 0 0 0 1px color-mix(in oklab, var(--primary) 30%, transparent)"
              : undefined,
            borderRadius: 10,
          }}
        >
          <span
            className="flex flex-shrink-0"
            style={{
              color: isActive
                ? "var(--primary)"
                : accent
                  ? "var(--c-xp)"
                  : "var(--text-3)",
            }}
          >
            {link.icon}
          </span>
          <motion.span
            animate={{ opacity: open ? 1 : 0 }}
            className="text-sm whitespace-pre inline-block !p-0 !m-0 flex-1 truncate"
          >
            {link.label}
          </motion.span>
          {right}
        </span>
      )}
    </NavLink>
  );
};
