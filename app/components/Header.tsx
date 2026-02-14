import Link from 'next/link';
import Logo from './Logo';

interface HeaderProps {
  logo: 'sm' | 'lg';
  children?: React.ReactNode;
}

const navLinkClass =
  'text-sm font-medium text-primary hover:text-primary-light transition-colors';

export default function Header({ logo, children }: HeaderProps) {
  return (
    <header className="flex flex-wrap items-center justify-between gap-4">
      <Link href="/">
        <Logo size={logo} />
      </Link>
      <nav className="flex flex-wrap items-center gap-4 mr-2">
        <Link href="/planner" className={navLinkClass}>
          Planner
        </Link>
        <Link href="/about" className={navLinkClass}>
          About
        </Link>
        {children}
      </nav>
    </header>
  );
}
