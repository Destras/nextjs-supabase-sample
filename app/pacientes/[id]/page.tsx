import { redirect } from 'next/navigation'

interface PageProps {
  params: Promise<{ id: string }>
}

const PacientePage = async ({ params }: PageProps): Promise<never> => {
  const { id } = await params
  redirect(`/pacientes/${id}/camino`)
}

export default PacientePage
