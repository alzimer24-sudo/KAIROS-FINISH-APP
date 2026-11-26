import React, { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, KeyboardAvoidingView, Platform,
  Pressable, RefreshControl, SafeAreaView, ScrollView, StatusBar,
  StyleSheet, Text, TextInput, View
} from 'react-native';
import type { Session } from '@supabase/supabase-js';
import { configured, supabase } from './supabase';
import AdminGroups from './AdminGroups';

type Group = { id:string; name:string; organization_id:string };
type Training = { id:string; group_id:string; title:string; started_on:string; discipline:string|null };
type Result = { id:string; bib:number; athlete_name:string; category:string; run_number:number; elapsed_us:number|null; status:string; timing_verified:boolean };
const BG='#06111d', PANEL='#0b253b', BORDER='#215277', WHITE='#f1f7fb', MUTED='#a9c2d7', CYAN='#54d9fb', GREEN='#4cf07b';
function prettyTime(us:number|null):string{
  if(us===null || us<0)return '—';
  const cs=Math.round(us/10000);
  return String(Math.floor(cs/6000)).padStart(2,'0')+':'+String(Math.floor(cs/100)%60).padStart(2,'0')+'.'+String(cs%100).padStart(2,'0');
}
function Button({label,onPress,disabled=false,secondary=false}:{label:string;onPress:()=>void;disabled?:boolean;secondary?:boolean}){
  return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.btn,secondary&&styles.secondary,disabled&&styles.disabled]}><Text style={[styles.btnText,secondary&&{color:CYAN}]}>{label}</Text></Pressable>;
}
export default function App(){
  const [session,setSession]=useState<Session|null>(null);
  const [ready,setReady]=useState(false);
  const [email,setEmail]=useState('');
  const [password,setPassword]=useState('');
  const [busy,setBusy]=useState(false);
  const [loading,setLoading]=useState(false);
  const [error,setError]=useState('');
  const [groups,setGroups]=useState<Group[]>([]);
  const [trainings,setTrainings]=useState<Training[]>([]);
  const [results,setResults]=useState<Result[]>([]);
  const [group,setGroup]=useState<Group|null>(null);
  const [training,setTraining]=useState<Training|null>(null);
  const [refresher,setRefresher]=useState(0);
  const [adminOpen,setAdminOpen]=useState(false);
  const [adminAllowed,setAdminAllowed]=useState(false);

  useEffect(()=>{
    let mounted=true;
    supabase.auth.getSession().then(({data})=>{if(mounted){setSession(data.session);setReady(true);}}).catch(()=>{if(mounted)setReady(true);});
    const {data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{if(mounted){setSession(s);setError('');setGroup(null);setTraining(null);setGroups([]);setTrainings([]);setResults([]);setAdminOpen(false);}});
    return ()=>{mounted=false;subscription.unsubscribe();};
  },[]);

  const loadGroups=useCallback(async()=>{
    if(!session)return;
    setLoading(true);setError('');
    const r=await supabase.from('kairos_groups').select('id,name,organization_id').order('name',{ascending:true});
    setLoading(false);
    if(r.error)setError('Impossibile caricare i gruppi autorizzati: '+r.error.message);
    else setGroups(r.data||[]);
  },[session?.user.id,refresher]);
  const loadTrainings=useCallback(async(selected:Group)=>{
    setLoading(true);setError('');
    const r=await supabase.from('kairos_sessions').select('id,group_id,title,started_on,discipline').eq('group_id',selected.id).order('started_on',{ascending:false});
    setLoading(false);
    if(r.error)setError('Impossibile caricare gli allenamenti: '+r.error.message);
    else setTrainings(r.data||[]);
  },[]);
  const loadResults=useCallback(async(selected:Training)=>{
    setLoading(true);setError('');
    const r=await supabase.from('kairos_results')
      .select('id,bib,athlete_name,category,run_number,elapsed_us,status,timing_verified')
      .eq('session_id',selected.id)
      .order('run_number',{ascending:true})
      .order('elapsed_us',{ascending:true,nullsFirst:false});
    setLoading(false);
    if(r.error)setError('Impossibile caricare la classifica: '+r.error.message);
    else setResults(r.data||[]);
  },[]);
  useEffect(()=>{if(session && !group && !adminOpen)void loadGroups();},[session?.user.id,group,loadGroups,adminOpen]);
  useEffect(()=>{
    let active=true;
    setAdminAllowed(false);
    if(!session)return ()=>{active=false;};
    supabase.from('kairos_org_members').select('organization_id').eq('user_id',session.user.id).in('role',['owner','admin']).limit(1)
      .then(({data,error})=>{if(active)setAdminAllowed(!error && (data?.length||0)>0);});
    return ()=>{active=false;};
  },[session?.user.id]);

  async function login(){
    if(!configured){setError('Manca la configurazione Supabase. Il proprietario deve collegare il proprio progetto prima di distribuire l’app.');return;}
    if(!email.trim() || !password){setError('Inserisci email e password.');return;}
    setBusy(true);setError('');
    const r=await supabase.auth.signInWithPassword({email:email.trim(),password});
    setBusy(false);
    if(r.error)setError('Accesso non riuscito: '+r.error.message);
    else setPassword('');
  }
  async function signOut(){
    setBusy(true); const r=await supabase.auth.signOut();setBusy(false);
    if(r.error)setError('Impossibile uscire: '+r.error.message);
  }
  function selectGroup(selected:Group){setGroup(selected);setTraining(null);setTrainings([]);setResults([]);void loadTrainings(selected);}
  function selectTraining(selected:Training){setTraining(selected);setResults([]);void loadResults(selected);}
  function refresh(){setRefresher(v=>v+1);if(training)void loadResults(training);else if(group)void loadTrainings(group);else void loadGroups();}
  const notConfigured=!configured;
  if(!ready)return <SafeAreaView style={styles.root}><ActivityIndicator color={CYAN} size="large"/></SafeAreaView>;
  return <SafeAreaView style={styles.root}>
    <StatusBar barStyle="light-content" backgroundColor={BG}/>
    <View style={styles.header}>
      <Text style={styles.brand}>KAIROS <Text style={{color:CYAN}}>CLOUD</Text></Text>
      <Text style={styles.subBrand}>RISULTATI E CLASSIFICHE · ACCESSO PRIVATO</Text>
    </View>
    {!session?<KeyboardAvoidingView style={{flex:1}} behavior={Platform.OS==='ios'?'padding':undefined}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.center}>
        <Text style={styles.title}>Accedi al tuo gruppo</Text>
        <Text style={styles.description}>Solo gli utenti invitati dal responsabile possono consultare allenamenti, tempi e classifiche.</Text>
        <Text style={styles.inputLabel}>Email</Text>
        <TextInput style={styles.input} value={email} onChangeText={setEmail} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" placeholder="nome@esempio.it" placeholderTextColor="#819baa"/>
        <Text style={styles.inputLabel}>Password</Text>
        <TextInput style={styles.input} value={password} onChangeText={setPassword} secureTextEntry textContentType="password" placeholder="Password personale" placeholderTextColor="#819baa"/>
        <Button label={busy?'ACCESSO…':'ENTRA IN KAIROS CLOUD'} onPress={()=>void login()} disabled={busy||notConfigured}/>
        {notConfigured?<Text style={styles.notice}>Versione di sviluppo: il progetto Supabase non è ancora collegato. Nessun dato reale è accessibile.</Text>:null}
        {error?<Text style={styles.error}>{error}</Text>:null}
        <Text style={styles.footer}>Non è prevista l’iscrizione libera: il responsabile autorizza personalmente ogni account.</Text>
      </ScrollView>
    </KeyboardAvoidingView>:adminOpen?<AdminGroups userId={session.user.id} onBack={()=>{setAdminOpen(false);setRefresher(n=>n+1);}} onChanged={()=>setRefresher(n=>n+1)}/>:<View style={{flex:1}}>
      <View style={styles.account}>
        <Text style={{color:MUTED,flex:1,fontSize:12}} numberOfLines={1}>{session.user.email}</Text>
        <Pressable onPress={()=>void signOut()} disabled={busy}><Text style={{color:CYAN,fontWeight:'700'}}>Esci</Text></Pressable>
      </View>
      {adminAllowed&&!group?<View style={{paddingHorizontal:20,paddingTop:12}}><Button label="⚙ GESTISCI GRUPPI E UTENTI" secondary onPress={()=>setAdminOpen(true)}/></View>:null}
      {group?<View style={styles.breadcrumb}><Pressable onPress={()=>{setGroup(null);setTraining(null);setTrainings([]);setResults([]);setError('');}}><Text style={styles.link}>‹ GRUPPI</Text></Pressable>{training?<Pressable onPress={()=>{setTraining(null);setResults([]);setError('');}}><Text style={styles.link}>‹ ALLENAMENTI</Text></Pressable>:null}</View>:null}
      <ScrollView contentContainerStyle={styles.content} refreshControl={<RefreshControl refreshing={loading} onRefresh={refresh} tintColor={CYAN}/>}>
        {!group?<><Text style={styles.title}>I tuoi gruppi</Text><Text style={styles.description}>Visualizzi esclusivamente i gruppi per i quali hai un'autorizzazione attiva.</Text>
          {groups.map(g=><Pressable key={g.id} style={styles.card} onPress={()=>selectGroup(g)}><Text style={styles.cardTitle}>👥 {g.name}</Text><Text style={styles.cardHint}>Apri allenamenti e classifiche  ›</Text></Pressable>)}
          {!groups.length&&!loading?<Text style={styles.notice}>Nessun gruppo autorizzato. Contatta il responsabile KAIROS per ricevere l'accesso.</Text>:null}
        </>:!training?<><Text style={styles.title}>{group.name}</Text><Text style={styles.description}>Allenamenti del gruppo selezionato.</Text>
          {trainings.map(t=><Pressable key={t.id} style={styles.card} onPress={()=>selectTraining(t)}><Text style={styles.cardTitle}>{t.title}</Text><Text style={styles.cardHint}>{t.started_on}{t.discipline?' · '+t.discipline:''}</Text><Text style={styles.cardHint}>Consulta risultati ›</Text></Pressable>)}
          {!trainings.length&&!loading?<Text style={styles.notice}>Nessun allenamento ancora pubblicato.</Text>:null}
        </>:<><Text style={styles.title}>{training.title}</Text><Text style={styles.description}>{training.started_on} · {group.name}</Text>
          <Text style={styles.heading}>Classifica</Text>
          {results.map(r=><View key={r.id} style={styles.resultRow}>
            <View style={{flex:1}}><Text style={styles.resultName}>#{r.bib}  {r.athlete_name}</Text><Text style={styles.cardHint}>{r.category}{r.category?' · ':''}Manche {r.run_number}</Text></View>
            <View style={{alignItems:'flex-end'}}><Text style={styles.resultTime}>{r.status==='FINISHED'?prettyTime(r.elapsed_us):r.status}</Text><Text style={styles.verification}>{r.timing_verified?'Verificato':'Da verificare'}</Text></View>
          </View>)}
          {!results.length&&!loading?<Text style={styles.notice}>Nessun risultato disponibile.</Text>:null}
          <Text style={styles.footer}>I risultati non verificati non costituiscono tempi ufficiali.</Text>
        </>}
        {loading?<ActivityIndicator color={CYAN} style={{marginVertical:16}}/>:null}
        {error?<Text style={styles.error}>{error}</Text>:null}
      </ScrollView>
    </View>}
  </SafeAreaView>;
}
const styles=StyleSheet.create({
 root:{flex:1,backgroundColor:BG},
 header:{paddingHorizontal:22,paddingTop:22,paddingBottom:16,borderBottomWidth:1,borderColor:BORDER},
 brand:{color:WHITE,fontSize:28,fontWeight:'900',letterSpacing:2},
 subBrand:{color:MUTED,fontSize:10,letterSpacing:1.5,marginTop:5},
 center:{padding:24,flexGrow:1,justifyContent:'center'},
 title:{fontSize:25,fontWeight:'800',color:WHITE,marginBottom:9},
 description:{color:MUTED,fontSize:14,lineHeight:21,marginBottom:22},
 inputLabel:{color:WHITE,marginBottom:8,fontSize:14,fontWeight:'700'},
 input:{backgroundColor:PANEL,borderWidth:1,borderColor:BORDER,borderRadius:10,color:WHITE,height:50,paddingHorizontal:13,marginBottom:18,fontSize:16},
 btn:{padding:16,backgroundColor:'#126399',borderRadius:11,alignItems:'center',marginVertical:8},
 btnText:{color:WHITE,fontWeight:'900',fontSize:14,letterSpacing:0.8},
 secondary:{backgroundColor:'transparent',borderColor:CYAN,borderWidth:1},
 disabled:{opacity:0.55},
 account:{padding:14,paddingHorizontal:22,flexDirection:'row',alignItems:'center',borderBottomWidth:1,borderColor:BORDER},
 content:{padding:20,paddingBottom:50},
 breadcrumb:{flexDirection:'row',paddingHorizontal:20,paddingTop:15,gap:20},
 link:{color:CYAN,fontSize:12,fontWeight:'800'},
 card:{backgroundColor:PANEL,borderWidth:1,borderColor:BORDER,borderRadius:12,padding:17,marginBottom:12},
 cardTitle:{color:WHITE,fontSize:17,fontWeight:'800',marginBottom:6},
 cardHint:{color:MUTED,fontSize:12,marginTop:4},
 heading:{fontSize:19,color:WHITE,fontWeight:'800',marginBottom:12},
 resultRow:{flexDirection:'row',alignItems:'center',backgroundColor:PANEL,borderColor:BORDER,borderWidth:1,padding:13,borderRadius:10,marginBottom:8},
 resultName:{color:WHITE,fontSize:14,fontWeight:'700'},
 resultTime:{color:GREEN,fontSize:19,fontWeight:'800',fontVariant:['tabular-nums']},
 verification:{color:MUTED,fontSize:10,marginTop:4},
 notice:{color:'#f9d67b',padding:16,backgroundColor:PANEL,borderRadius:9,lineHeight:21,marginVertical:12},
 error:{color:'#ff9999',padding:12,marginTop:10},
 footer:{color:MUTED,fontSize:12,lineHeight:19,marginTop:23}
});
