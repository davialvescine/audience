type User = {
  id: string;
  email: string;
  last_sign_in_at: string | null | undefined;
  created_at: string;
};

export function UsersList({ users }: { users: User[] }) {
  if (users.length === 0) {
    return <p className="text-sm text-ink/60">Nenhum usuário ainda.</p>;
  }
  return (
    <ul className="divide-y divide-ink/10">
      {users.map((u) => (
        <li key={u.id} className="py-3 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-ink truncate">{u.email}</p>
            <p className="text-xs text-ink/50">
              {u.last_sign_in_at
                ? `Último login: ${new Date(u.last_sign_in_at).toLocaleDateString('pt-BR')}`
                : 'Nunca logou'}
            </p>
          </div>
          <span className="text-xs text-ink/40">
            Criado {new Date(u.created_at).toLocaleDateString('pt-BR')}
          </span>
        </li>
      ))}
    </ul>
  );
}
