-- Diseño inicial orientativo para migrar la demo a PostgreSQL.
-- No conectado al servidor actual ni ejecutado contra una instancia PostgreSQL.
-- La API actual persiste un agregado local en backend/data/state.json.
BEGIN;

CREATE TABLE demo_profile_versions (
  user_id text NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  name text NOT NULL CHECK (length(name) BETWEEN 1 AND 60),
  age integer NOT NULL CHECK (age BETWEEN 18 AND 120),
  objective text NOT NULL CHECK (objective IN ('bajar', 'mantener', 'subir')),
  level text NOT NULL CHECK (level IN ('principiante', 'intermedio')),
  days integer[] NOT NULL CHECK (cardinality(days) BETWEEN 1 AND 7),
  duration_minutes integer NOT NULL CHECK (duration_minutes IN (20, 30, 45, 60)),
  equipment text NOT NULL CHECK (equipment IN ('sin_equipo', 'con_equipo')),
  updated_at timestamptz NOT NULL,
  demo boolean NOT NULL DEFAULT true CHECK (demo),
  PRIMARY KEY (user_id, version)
);

CREATE TABLE demo_drafts (
  id uuid PRIMARY KEY,
  user_id text NOT NULL,
  profile_version integer NOT NULL,
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL CHECK (status IN ('draft', 'in_review', 'approved', 'rejected', 'superseded')),
  template_id text NOT NULL,
  template_version integer NOT NULL CHECK (template_version > 0),
  content jsonb NOT NULL,
  created_at timestamptz NOT NULL,
  submitted_at timestamptz,
  superseded_at timestamptz,
  demo boolean NOT NULL DEFAULT true CHECK (demo),
  UNIQUE (user_id, version),
  UNIQUE (id, profile_version),
  FOREIGN KEY (user_id, profile_version) REFERENCES demo_profile_versions (user_id, version)
);

CREATE TABLE demo_reviews (
  id uuid PRIMARY KEY,
  draft_id uuid NOT NULL UNIQUE,
  profile_version integer NOT NULL,
  decision text NOT NULL CHECK (decision IN ('approved', 'rejected')),
  notes text NOT NULL DEFAULT '' CHECK (length(notes) <= 500),
  reviewed_by text NOT NULL,
  reviewed_role text NOT NULL CHECK (reviewed_role = 'trainer'),
  reviewed_at timestamptz NOT NULL,
  demo boolean NOT NULL DEFAULT true CHECK (demo),
  CHECK (decision <> 'rejected' OR length(trim(notes)) > 0),
  FOREIGN KEY (draft_id, profile_version) REFERENCES demo_drafts (id, profile_version)
);

CREATE TABLE demo_plans (
  id uuid PRIMARY KEY,
  draft_id uuid NOT NULL REFERENCES demo_drafts (id),
  review_id uuid NOT NULL UNIQUE REFERENCES demo_reviews (id),
  approved_at timestamptz NOT NULL,
  content jsonb NOT NULL,
  demo boolean NOT NULL DEFAULT true CHECK (demo)
);

-- Pendiente para el repositorio PostgreSQL: comprobar días únicos de 1 a 7;
-- revisión vigente, estado y decisión aprobada dentro de la transacción;
-- permisos por usuario asignado; conservación y publicación del último plan.
COMMIT;
