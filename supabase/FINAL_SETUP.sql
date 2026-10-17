-- Run ONCE in Supabase SQL Editor AFTER backing up your data.
-- Compatible with existing public.machines(machine_code UUID-backed id), public.user_roles.
-- This migration does not drop tables or delete rows.

CREATE EXTENSION IF NOT EXISTS pgcrypto;
CREATE TABLE IF NOT EXISTS public.plantops_alarm_events (
 id text PRIMARY KEY, machine_code text NOT NULL REFERENCES public.machines(machine_code),
 severity text NOT NULL CHECK (severity IN ('Critical','Warning')),
 message text NOT NULL, status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','Acknowledged','Resolved')),
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS public.plantops_work_orders (
 id text PRIMARY KEY, machine_code text NOT NULL REFERENCES public.machines(machine_code),
 title text NOT NULL, priority text NOT NULL DEFAULT 'Medium' CHECK (priority IN ('High','Medium','Low')),
 status text NOT NULL DEFAULT 'Open' CHECK (status IN ('Open','In Progress','Completed')),
 created_at timestamptz NOT NULL DEFAULT now()
);
-- Ensure new machine rows have a UUID when inserted by the website.
ALTER TABLE public.machines ALTER COLUMN id SET DEFAULT gen_random_uuid();
ALTER TABLE public.machines ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantops_alarm_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.plantops_work_orders ENABLE ROW LEVEL SECURITY;
GRANT SELECT,INSERT,UPDATE,DELETE ON public.machines TO authenticated;
GRANT SELECT,INSERT,UPDATE ON public.plantops_alarm_events,public.plantops_work_orders TO authenticated;

-- Helper uses invoker privileges (user_roles must allow role SELECT for self).
CREATE OR REPLACE FUNCTION public.plantops_has_role(allowed text[])
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
 SELECT EXISTS (SELECT 1 FROM public.user_roles
 WHERE user_id = (SELECT auth.uid()) AND role = ANY(allowed));
$$;
GRANT EXECUTE ON FUNCTION public.plantops_has_role(text[]) TO authenticated;

DROP POLICY IF EXISTS "plantops_machine_read" ON public.machines;
CREATE POLICY "plantops_machine_read" ON public.machines FOR SELECT TO authenticated
 USING (public.plantops_has_role(ARRAY['admin','technician']));
DROP POLICY IF EXISTS "plantops_machine_insert" ON public.machines;
CREATE POLICY "plantops_machine_insert" ON public.machines FOR INSERT TO authenticated
 WITH CHECK (public.plantops_has_role(ARRAY['admin']));
DROP POLICY IF EXISTS "plantops_machine_update" ON public.machines;
CREATE POLICY "plantops_machine_update" ON public.machines FOR UPDATE TO authenticated
 USING (public.plantops_has_role(ARRAY['admin'])) WITH CHECK (public.plantops_has_role(ARRAY['admin']));
DROP POLICY IF EXISTS "plantops_machine_delete" ON public.machines;
CREATE POLICY "plantops_machine_delete" ON public.machines FOR DELETE TO authenticated
 USING (public.plantops_has_role(ARRAY['admin']));

DROP POLICY IF EXISTS "plantops_alarm_read" ON public.plantops_alarm_events;
CREATE POLICY "plantops_alarm_read" ON public.plantops_alarm_events FOR SELECT TO authenticated
 USING (public.plantops_has_role(ARRAY['admin','technician']));
DROP POLICY IF EXISTS "plantops_alarm_insert" ON public.plantops_alarm_events;
CREATE POLICY "plantops_alarm_insert" ON public.plantops_alarm_events FOR INSERT TO authenticated
 WITH CHECK (public.plantops_has_role(ARRAY['admin']));
DROP POLICY IF EXISTS "plantops_alarm_update" ON public.plantops_alarm_events;
CREATE POLICY "plantops_alarm_update" ON public.plantops_alarm_events FOR UPDATE TO authenticated
 USING (public.plantops_has_role(ARRAY['admin','technician']))
 WITH CHECK (public.plantops_has_role(ARRAY['admin','technician']));

DROP POLICY IF EXISTS "plantops_work_read" ON public.plantops_work_orders;
CREATE POLICY "plantops_work_read" ON public.plantops_work_orders FOR SELECT TO authenticated
 USING (public.plantops_has_role(ARRAY['admin','technician']));
DROP POLICY IF EXISTS "plantops_work_insert" ON public.plantops_work_orders;
CREATE POLICY "plantops_work_insert" ON public.plantops_work_orders FOR INSERT TO authenticated
 WITH CHECK (public.plantops_has_role(ARRAY['admin']));
DROP POLICY IF EXISTS "plantops_work_update" ON public.plantops_work_orders;
CREATE POLICY "plantops_work_update" ON public.plantops_work_orders FOR UPDATE TO authenticated
 USING (public.plantops_has_role(ARRAY['admin','technician']))
 WITH CHECK (public.plantops_has_role(ARRAY['admin','technician']));

-- Prevent technician from changing alarm/work-order details, not just their status.
CREATE OR REPLACE FUNCTION public.plantops_limit_technician_updates()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
BEGIN
 IF public.plantops_has_role(ARRAY['technician']) AND NOT public.plantops_has_role(ARRAY['admin']) THEN
   IF TG_TABLE_NAME = 'plantops_alarm_events' THEN
     IF NEW.id IS DISTINCT FROM OLD.id OR NEW.machine_code IS DISTINCT FROM OLD.machine_code
       OR NEW.severity IS DISTINCT FROM OLD.severity OR NEW.message IS DISTINCT FROM OLD.message
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
       RAISE EXCEPTION 'Technician may update alarm status only';
     END IF;
   ELSIF TG_TABLE_NAME = 'plantops_work_orders' THEN
     IF NEW.id IS DISTINCT FROM OLD.id OR NEW.machine_code IS DISTINCT FROM OLD.machine_code
       OR NEW.title IS DISTINCT FROM OLD.title OR NEW.priority IS DISTINCT FROM OLD.priority
       OR NEW.created_at IS DISTINCT FROM OLD.created_at THEN
       RAISE EXCEPTION 'Technician may update work order status only';
     END IF;
   END IF;
 END IF;
 RETURN NEW;
END; $$;
DROP TRIGGER IF EXISTS plantops_alarm_tech_guard ON public.plantops_alarm_events;
CREATE TRIGGER plantops_alarm_tech_guard BEFORE UPDATE ON public.plantops_alarm_events
 FOR EACH ROW EXECUTE FUNCTION public.plantops_limit_technician_updates();
DROP TRIGGER IF EXISTS plantops_work_tech_guard ON public.plantops_work_orders;
CREATE TRIGGER plantops_work_tech_guard BEFORE UPDATE ON public.plantops_work_orders
 FOR EACH ROW EXECUTE FUNCTION public.plantops_limit_technician_updates();

-- IMPORTANT: Existing policies are additive. Review/remove overly permissive legacy policies.
SELECT schemaname, tablename, policyname, cmd FROM pg_policies
 WHERE schemaname='public' AND tablename IN ('machines','plantops_alarm_events','plantops_work_orders')
 ORDER BY tablename,policyname;
