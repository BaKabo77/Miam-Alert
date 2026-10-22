import { useState } from 'react';

// Données d'exemple, en attendant de les lire depuis l'API.
const SAMPLE_ITEMS = [
  { id: '1', name: 'Lait', daysLeft: 1 },
  { id: '2', name: 'Yaourt nature', daysLeft: 4 },
  { id: '3', name: 'Pâtes', daysLeft: 200 },
];

interface PantryItemRowProps {
  name: string;
  daysLeft: number;
}

// Un composant = une fonction qui reçoit des props et renvoie du JSX.
function PantryItemRow({ name, daysLeft }: PantryItemRowProps) {
  return (
    <li className={daysLeft <= 2 ? 'font-semibold text-red-700' : 'text-gray-700'}>
      {name} — {daysLeft <= 2 ? 'à consommer vite' : `${daysLeft} jours`}
    </li>
  );
}


export default function App() {
  // État local : quand il change, React réaffiche le composant.
  const [showAll, setShowAll] = useState(false);
  const items = showAll ? SAMPLE_ITEMS : SAMPLE_ITEMS.filter((item) => item.daysLeft <= 7);

    return (
    <main className="mx-auto max-w-md p-4">
      <h1 className="mb-4 text-2xl font-bold text-green-700">Miam'Alert</h1>
      <button
        type="button"
        className="mb-4 rounded bg-green-700 px-3 py-2 text-white hover:bg-green-800"
        onClick={() => setShowAll(!showAll)}
      >
        {showAll ? 'Seulement les urgents' : 'Tout afficher'}
      </button>
      <ul className="space-y-1">
        {items.map((item) => (
          <PantryItemRow key={item.id} name={item.name} daysLeft={item.daysLeft} />
        ))}
      </ul>
    </main>
  );

}
