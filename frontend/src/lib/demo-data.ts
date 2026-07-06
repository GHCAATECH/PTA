import type { AcademicYear, DashboardStats, Payment, Profile, SchoolClass, Student } from '../types'

export const demoProfile: Profile = { id: 'demo-admin', full_name: 'Ama Mensah', email: 'admin@school.edu.gh', role: 'administrator' }
export const demoYears: AcademicYear[] = [{ id: 'y1', year: '2026/2027', is_active: true }, { id: 'y0', year: '2025/2026', is_active: false }]
export const demoClasses: SchoolClass[] = ['Nursery','KG 1','KG 2','Primary 1','Primary 2','Primary 3','Primary 4','Primary 5','Primary 6','JHS 1','JHS 2','JHS 3'].map((name, i) => ({ id: `c${i+1}`, name }))
const names = [['Kwame','Asante','Male'],['Adwoa','Owusu','Female'],['Yaw','Boateng','Male'],['Akosua','Nyarko','Female'],['Kofi','Appiah','Male'],['Abena','Ofori','Female'],['Kojo','Antwi','Male'],['Ama','Danso','Female']] as const
export const demoStudents: Student[] = names.map(([first,last,gender], i) => {
  const paid = [300,200,0,150,300,80,300,250][i]
  return { id:`s${i+1}`, admission_number:`APS/26/${String(i+1).padStart(3,'0')}`, first_name:first, last_name:last, gender, class_id:demoClasses[i+2].id, class_name:demoClasses[i+2].name, parent_name:`${['Mr','Mrs'][i%2]} ${last}`, parent_phone:`024 ${5551000+i}`, address:'Accra, Ghana', status:'active', fee:300, total_paid:paid, balance:300-paid, payment_status:paid===300?'PAID':paid===0?'UNPAID':'PARTIALLY PAID' }
})
export const demoPayments: Payment[] = demoStudents.filter(s=>s.total_paid>0).map((s,i)=>({ id:`p${i+1}`, student_id:s.id, student_name:`${s.first_name} ${s.last_name}`, admission_number:s.admission_number, class_name:s.class_name, academic_year:'2026/2027', amount_paid:[300,100,150,80,300,250][i]??100, payment_date:new Date(Date.now()-i*86400000).toISOString(), receipt_number:`PTA-2026-${String(128-i).padStart(6,'0')}`, remarks:i%2?'Mobile money':'Cash payment', received_by_name:'Ama Mensah', total_paid:s.total_paid, outstanding_balance:s.balance }))
export const demoStats: DashboardStats = { total_students: 486, total_expected:145800, total_collected:110760, outstanding:35040, total_debt:180840, fully_paid:302, owing:184, today_collected:2850 }
export const monthlyData = [{month:'Jan',amount:12400},{month:'Feb',amount:16800},{month:'Mar',amount:14200},{month:'Apr',amount:21600},{month:'May',amount:18700},{month:'Jun',amount:27060}]
