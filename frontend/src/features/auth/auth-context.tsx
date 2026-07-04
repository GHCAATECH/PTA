import type { Session } from '@supabase/supabase-js'
import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { demoProfile } from '../../lib/demo-data'
import { isDemoMode, supabase } from '../../lib/supabase'
import { studentLoginEmail } from '../../lib/student-auth'
import type { Profile } from '../../types'

export interface StudentAccount { user_id:string;student_id:string;login_email:string }
type AuthValue={session:Session|null;profile:Profile|null;studentAccount:StudentAccount|null;loading:boolean;demo:boolean;signIn:(email:string,password:string)=>Promise<void>;signInStudent:(studentId:string,password:string)=>Promise<void>;signOut:()=>Promise<void>}
const AuthContext=createContext<AuthValue|null>(null)

export function AuthProvider({children}:{children:ReactNode}){
 const [session,setSession]=useState<Session|null>(null),[profile,setProfile]=useState<Profile|null>(isDemoMode?demoProfile:null),[studentAccount,setStudentAccount]=useState<StudentAccount|null>(null),[loading,setLoading]=useState(!isDemoMode)
 useEffect(()=>{if(isDemoMode)return;let active=true;const loadIdentity=async(s:Session|null)=>{if(!active)return;setSession(s);if(!s){setProfile(null);setStudentAccount(null);setLoading(false);return}const {data:p}=await supabase.from('profiles').select('*').eq('id',s.user.id).maybeSingle();if(!active)return;if(p){setProfile(p);setStudentAccount(null)}else{const {data:a}=await supabase.from('student_accounts').select('user_id,student_id,login_email').eq('user_id',s.user.id).maybeSingle();setProfile(null);setStudentAccount(a)}setLoading(false)};supabase.auth.getSession().then(({data})=>loadIdentity(data.session));const {data}=supabase.auth.onAuthStateChange((_,s)=>{void loadIdentity(s)});return()=>{active=false;data.subscription.unsubscribe()}},[])
 const value=useMemo<AuthValue>(()=>({session,profile,studentAccount,loading,demo:isDemoMode,signIn:async(email,password)=>{if(isDemoMode){setProfile(demoProfile);return}const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw error},signInStudent:async(studentId,password)=>{if(isDemoMode)throw new Error('Connect Supabase to use the student portal');const email=await studentLoginEmail(studentId);const {error}=await supabase.auth.signInWithPassword({email,password});if(error)throw new Error('Invalid Student ID or password')},signOut:async()=>{if(!isDemoMode)await supabase.auth.signOut();setProfile(isDemoMode?demoProfile:null);setStudentAccount(null)}}),[session,profile,studentAccount,loading])
 return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
// oxlint-disable-next-line react/only-export-components
export const useAuth=()=>{const value=useContext(AuthContext);if(!value)throw new Error('useAuth must be used within AuthProvider');return value}
