import type { ReactNode } from 'react';
import { Link } from 'react-router';
import householdScreen from '../assets/landing/household.webp';
import inventoryScreen from '../assets/landing/inventory.webp';
import recipesScreen from '../assets/landing/recipes.webp';
import { BellIcon, CalendarIcon, HomeIcon, LeafIcon, PotIcon, ScanIcon } from '../components/icons';
import { Logo } from '../components/Logo';
import { LegalLinks } from '../legal/LegalLayout';

// Page d'accueil des visiteurs non connectés (affichée à la place de l'inventaire sur « / », voir
// RequireAuth). Entièrement statique : aucun appel à l'API, aucune donnée personnelle. Les captures
// viennent d'un compte de démonstration (prénoms et produits fictifs).
// Chaque phrase doit rester vraie : elle décrit ce que fait réellement l'application.
export function LandingPage() {
  return (
    <div className="min-h-dvh bg-white">
      <header className="sticky top-0 z-10 border-b border-line bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-5 py-3">
          <Logo />
          <nav aria-label="Compte" className="flex items-center gap-2">
            <Link to="/login" className="rounded-full px-4 py-2 text-sm font-bold text-ink-900 transition hover:bg-mist">
              Se connecter
            </Link>
            <Link
              to="/register"
              className="hidden rounded-full bg-ink-900 px-4 py-2 text-sm font-bold text-white transition hover:bg-ink-900/85 sm:inline-flex"
            >
              Créer un compte
            </Link>
          </nav>
        </div>
      </header>

      <main>
        {/* Accroche */}
        <section className="overflow-hidden bg-gradient-to-b from-white via-peach-100/60 to-peach-100">
          <div className="mx-auto grid max-w-5xl items-center gap-10 px-5 pt-10 pb-0 md:grid-cols-[1.1fr_1fr] md:pt-16">
            <div className="text-center md:pb-16 md:text-left">
              <p className="inline-flex rounded-full bg-white px-3 py-1 text-xs font-bold text-peach-800 ring-1 ring-peach-800/15">
                Gratuit · sans publicité
              </p>
              <h1 className="mt-4 text-[40px] leading-[1.02] font-extrabold tracking-[-0.035em] md:text-[56px]">
                Moins de gaspillage,
                <br />
                <span className="text-brand">sans y penser.</span>
              </h1>
              <p className="mx-auto mt-4 max-w-md text-[17px] text-ink-600 md:mx-0">
                Miam'Alert suit les dates de péremption de vos courses, vous prévient chaque matin et vous propose des
                recettes pour finir d'abord ce qui périme.
              </p>
              <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center md:justify-start">
                <Link to="/register" className="btn-primary">
                  Créer mon compte gratuit
                </Link>
                <Link to="/login" className="btn-secondary">
                  J'ai déjà un compte
                </Link>
              </div>
            </div>
            <div className="flex justify-center md:justify-end">
              <PhoneFrame
                src={inventoryScreen}
                alt="L'inventaire : alerte du matin, idée de recette et produits classés du plus urgent au moins urgent"
                className="w-[260px] translate-y-6 md:w-[300px]"
                eager
              />
            </div>
          </div>
        </section>

        {/* Fonctionnement */}
        <section className="mx-auto max-w-5xl px-5 py-16">
          <h2 className="text-center text-[28px] leading-tight font-extrabold tracking-[-0.03em]">Comment ça marche</h2>
          <ol className="mt-8 grid gap-4 md:grid-cols-3">
            <Step number={1} icon={<ScanIcon className="h-6 w-6" />} title="Scannez vos courses">
              Le code-barres suffit à retrouver le produit. Une date est proposée selon le type de produit : vous la
              corrigez en un geste.
            </Step>
            <Step number={2} icon={<BellIcon className="h-6 w-6" />} title="Recevez l'alerte du matin">
              Chaque matin, l'application résume ce qui est périmé et ce qu'il faut manger vite.
            </Step>
            <Step number={3} icon={<PotIcon className="h-6 w-6" />} title="Cuisinez ce qui presse">
              Des idées de recettes utilisent d'abord les produits les plus urgents, avec la liste de ce qui manque.
            </Step>
          </ol>
        </section>

        {/* Fonctionnalités, avec deux écrans */}
        <section className="bg-mist">
          <div className="mx-auto grid max-w-5xl items-center gap-12 px-5 py-16 md:grid-cols-2">
            <div className="flex justify-center gap-4">
              <PhoneFrame
                src={recipesScreen}
                alt="Les idées de recettes, avec les produits à finir mis en couleur"
                className="w-[160px] translate-y-6 sm:w-[200px]"
              />
              <PhoneFrame
                src={householdScreen}
                alt="Le foyer partagé : deux membres et l'invitation par lien"
                className="w-[160px] sm:w-[200px]"
              />
            </div>
            <div>
              <h2 className="text-[28px] leading-tight font-extrabold tracking-[-0.03em]">Pensé pour la vraie vie</h2>
              <ul className="mt-6 space-y-5">
                <Feature icon={<CalendarIcon className="h-5 w-5" />} title="DLC et DDM, enfin distinguées">
                  Une DLC dépassée signale un produit à ne plus manger ; une DDM dépassée, un produit encore bon le plus
                  souvent. Les recettes ne proposent jamais un produit à DLC dépassée.
                </Feature>
                <Feature icon={<HomeIcon className="h-5 w-5" />} title="Un inventaire pour tout le foyer">
                  Invitez les personnes avec qui vous vivez : tout le monde voit et met à jour le même inventaire.
                </Feature>
                <Feature icon={<LeafIcon className="h-5 w-5" />} title="Sur votre téléphone, sans store">
                  L'application s'installe depuis le navigateur, sur téléphone comme sur ordinateur.
                </Feature>
              </ul>
            </div>
          </div>
        </section>

        {/* Confidentialité : uniquement ce qui est vrai et vérifiable dans la politique de confidentialité. */}
        <section className="mx-auto max-w-5xl px-5 py-16">
          <div className="rounded-3xl bg-ink-900 p-7 text-white md:p-10">
            <h2 className="text-[26px] leading-tight font-extrabold tracking-[-0.03em]">Vos données restent les vôtres</h2>
            <ul className="mt-6 grid gap-4 text-[15px] text-white/85 sm:grid-cols-2">
              <li>
                <strong className="text-white">Ni publicité, ni revente.</strong> Seuls l'email et le mot de passe sont
                obligatoires.
              </li>
              <li>
                <strong className="text-white">Aucun cookie de pistage.</strong> La mesure d'audience est anonyme et
                hébergée par l'éditeur.
              </li>
              <li>
                <strong className="text-white">Hébergé dans l'Union européenne</strong>, avec des sauvegardes chiffrées.
              </li>
              <li>
                <strong className="text-white">Export et suppression du compte</strong> depuis votre profil, à tout
                moment.
              </li>
            </ul>
            <Link to="/privacy" className="mt-6 inline-block text-sm font-bold text-brand underline underline-offset-4">
              Lire la politique de confidentialité
            </Link>
          </div>
        </section>

        {/* Appel final */}
        <section className="px-5 pb-16 text-center">
          <h2 className="text-[28px] leading-tight font-extrabold tracking-[-0.03em]">Prêt à moins jeter ?</h2>
          <p className="mt-2 text-ink-600">Gratuit, sans engagement, en moins d'une minute.</p>
          <Link to="/register" className="btn-primary mt-6">
            Créer mon compte gratuit
          </Link>
        </section>
      </main>

      <footer className="border-t border-line px-5 py-8">
        <LegalLinks />
      </footer>
    </div>
  );
}

function PhoneFrame({ src, alt, className = '', eager = false }: { src: string; alt: string; className?: string; eager?: boolean }) {
  return (
    <div className={`rounded-[2.2rem] bg-ink-900 p-2 shadow-[0_24px_50px_rgba(154,52,18,0.22)] ${className}`}>
      {/* Dimensions indiquées : la page ne saute pas pendant le chargement de l'image. */}
      <img
        src={src}
        alt={alt}
        width={780}
        height={1688}
        loading={eager ? 'eager' : 'lazy'}
        className="block h-auto w-full rounded-[1.7rem]"
      />
    </div>
  );
}

function Step({ number, icon, title, children }: { number: number; icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="card p-6">
      <div className="flex items-center gap-3">
        <span className="grid h-12 w-12 place-items-center rounded-full bg-brand text-ink-900">{icon}</span>
        <span className="text-sm font-bold text-ink-600">Étape {number}</span>
      </div>
      <h3 className="mt-4 text-lg font-extrabold">{title}</h3>
      <p className="mt-1 text-[15px] text-ink-600">{children}</p>
    </li>
  );
}

function Feature({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <li className="flex gap-4">
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-peach-100 text-peach-800">{icon}</span>
      <div>
        <h3 className="font-extrabold">{title}</h3>
        <p className="mt-0.5 text-[15px] text-ink-600">{children}</p>
      </div>
    </li>
  );
}
