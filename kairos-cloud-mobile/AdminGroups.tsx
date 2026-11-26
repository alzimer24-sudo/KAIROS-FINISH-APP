import React, {useEffect,useState} from 'react';
import {ActivityIndicator,Alert,Pressable,ScrollView,StyleSheet,Text,TextInput,View} from 'react-native';
import {supabase} from './supabase';

type Organization={organization_id:string; role:string; kairos_organizations:{name:string}|null};
type Group={id:string; organization_id:string; name:string};
type Member={user_id:string;email:string};
const C={bg:'#06111d',panel:'#0b253b',border:'#215277',text:'#f1f7fb',muted:'#a9c2d7',cyan:'#54d9fb',error:'#ff9999'};
function Action({text,onPress,disabled=false}:{text:string;onPress:()=>void;disabled?:boolean}) {
 return <Pressable accessibilityRole="button" disabled={disabled} onPress={onPress} style={[styles.action,disabled&&{opacity:0.45}]}><Text style={styles.actionText}>{text}</Text></Pressable>;
}
export default function AdminGroups({userId,onBack,onChanged}:{userId:string;onBack:()=>void;onChanged:()=>void}) {
 const [orgs,setOrgs]=useState<Organization[]>([]);
 const [selectedOrg,setSelectedOrg]=useState('');
 const [groups,setGroups]=useState<Group[]>([]);
 const [newGroup,setNewGroup]=useState('');
 const [selectedGroup,setSelectedGroup]=useState<Group|null>(null);
 const [members,setMembers]=useState<Member[]>([]);
 const [email,setEmail]=useState('');
 const [loading,setLoading]=useState(false);
 const [message,setMessage]=useState('');
 const [error,setError]=useState('');

 async function loadOrganizations() {
  setLoading(true);setError('');
  const r=await supabase.from('kairos_org_members')
   .select('organization_id,role,kairos_organizations(name)')
   .eq('user_id',userId).in('role',['owner','admin']);
  setLoading(false);
  if(r.error){setError('Impossibile leggere le autorizzazioni: '+r.error.message);return;}
  const data=(r.data||[]) as unknown as Organization[];
  setOrgs(data);
  setSelectedOrg(prev=>data.some(o=>o.organization_id===prev)?prev:(data[0]?.organization_id||''));
 }
 async function loadGroups(orgId:string) {
  if(!orgId)return;
  setLoading(true);setError('');
  const r=await supabase.from('kairos_groups').select('id,organization_id,name')
   .eq('organization_id',orgId).order('name');
  setLoading(false);
  if(r.error)setError('Impossibile caricare i gruppi: '+r.error.message);
  else setGroups(r.data||[]);
 }
 async function loadMembers(groupId:string) {
  setLoading(true);setError('');
  const r=await supabase.rpc('kairos_list_group_members',{p_group_id:groupId});
  setLoading(false);
  if(r.error)setError('Impossibile caricare gli utenti: '+r.error.message);
  else setMembers((r.data||[]) as Member[]);
 }
 useEffect(()=>{void loadOrganizations();},[userId]);
 useEffect(()=>{if(selectedOrg){void loadGroups(selectedOrg);setSelectedGroup(null);setMembers([]);}},[selectedOrg]);
 async function createGroup() {
  const name=newGroup.trim();
  if(!selectedOrg||name.length<1||name.length>120){setError('Inserisci un nome gruppo valido.');return;}
  setLoading(true);setError('');setMessage('');
  const r=await supabase.rpc('kairos_create_group',{p_organization_id:selectedOrg,p_name:name});
  setLoading(false);
  if(r.error)setError('Creazione non riuscita: '+r.error.message);
  else{setNewGroup('');setMessage('Gruppo creato.');await loadGroups(selectedOrg);onChanged();}
 }
 async function addMember() {
  if(!selectedGroup)return;
  const address=email.trim().toLowerCase();
  if(!/^\S+@\S+\.\S+$/.test(address)){setError('Inserisci una email valida.');return;}
  setLoading(true);setError('');setMessage('');
  const r=await supabase.rpc('kairos_add_group_member',{p_group_id:selectedGroup.id,p_email:address});
  setLoading(false);
  if(r.error)setError('Utente non aggiunto: '+r.error.message);
  else {setEmail('');setMessage('Utente autorizzato al gruppo.');await loadMembers(selectedGroup.id);}
 }
 function confirmRemove(member:Member) {
  if(!selectedGroup)return;
  Alert.alert('Revocare l’accesso?',member.email+' non potrà più consultare gli allenamenti di questo gruppo.',[
   {text:'Annulla',style:'cancel'},
   {text:'Revoca',style:'destructive',onPress:()=>{void (async()=>{
    setLoading(true);setError('');
    const r=await supabase.rpc('kairos_remove_group_member',{p_group_id:selectedGroup.id,p_user_id:member.user_id});
    setLoading(false);
    if(r.error)setError('Revoca non riuscita: '+r.error.message);
    else {setMessage('Accesso revocato.');await loadMembers(selectedGroup.id);}
   })();}}
  ]);
 }
 return <View style={styles.container}>
  <View style={styles.header}>
   <Pressable onPress={onBack}><Text style={styles.back}>‹ Torna ai gruppi</Text></Pressable>
   <Text style={styles.title}>Gestione sci club</Text>
   <Text style={styles.muted}>Crea gruppi e autorizza gli utenti direttamente dall’app.</Text>
  </View>
  <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
   {!orgs.length&&!loading?<Text style={styles.warning}>Il tuo account non ha ancora un ruolo proprietario o amministratore.</Text>:null}
   {orgs.length>0?<><Text style={styles.label}>SCI CLUB</Text>
    {orgs.map(o=><Pressable key={o.organization_id} onPress={()=>{setSelectedOrg(o.organization_id);setError('');setMessage('');}} style={[styles.choice,selectedOrg===o.organization_id&&styles.selected]}>
      <Text style={styles.choiceText}>{o.kairos_organizations?.name||'Sci club'} {selectedOrg===o.organization_id?'✓':''}</Text>
      <Text style={styles.muted}>{o.role==='owner'?'Proprietario':'Amministratore'}</Text>
    </Pressable>)}
    <Text style={styles.label}>NUOVO GRUPPO</Text>
    <TextInput style={styles.input} placeholder="Es. Under 14 / Master" placeholderTextColor="#819baa" value={newGroup} onChangeText={setNewGroup} maxLength={120}/>
    <Action text="＋ CREA GRUPPO" onPress={()=>void createGroup()} disabled={loading||!newGroup.trim()}/>
    <Text style={styles.label}>GRUPPI ESISTENTI</Text>
    {groups.map(g=><Pressable key={g.id} style={[styles.choice,selectedGroup?.id===g.id&&styles.selected]} onPress={()=>{setSelectedGroup(g);setMessage('');setError('');void loadMembers(g.id);}}>
       <Text style={styles.choiceText}>{g.name}</Text>
       <Text style={styles.muted}>Gestisci utenti ›</Text>
    </Pressable>)}
    {!groups.length&&!loading?<Text style={styles.muted}>Ancora nessun gruppo.</Text>:null}
    {selectedGroup?<View style={styles.panel}>
      <Text style={styles.subTitle}>Autorizzazioni: {selectedGroup.name}</Text>
      <Text style={styles.muted}>Puoi aggiungere persone che hanno già un account KAIROS CLOUD. Gli inviti per nuovi account saranno aggiunti successivamente.</Text>
      <TextInput style={styles.input} placeholder="Email dell’utente" placeholderTextColor="#819baa" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoCorrect={false}/>
      <Action text="AUTORIZZA UTENTE" disabled={loading||!email.trim()} onPress={()=>void addMember()}/>
      <Text style={styles.label}>UTENTI AUTORIZZATI</Text>
      {members.map(m=><View key={m.user_id} style={styles.member}>
        <Text style={[styles.choiceText,{flex:1}]} numberOfLines={1}>{m.email}</Text>
        <Pressable onPress={()=>confirmRemove(m)} disabled={loading}><Text style={styles.remove}>Revoca</Text></Pressable>
      </View>)}
      {!members.length&&!loading?<Text style={styles.muted}>Nessun utente ancora autorizzato.</Text>:null}
    </View>:null}
   </>:null}
   {loading?<ActivityIndicator color={C.cyan} style={{marginTop:15}}/>:null}
   {message?<Text style={styles.success}>{message}</Text>:null}
   {error?<Text style={styles.error}>{error}</Text>:null}
   <Text style={styles.small}>L'accesso ai risultati è controllato dal database. Gli altri sci club non possono gestire i tuoi gruppi.</Text>
  </ScrollView>
 </View>;
}
const styles=StyleSheet.create({
 container:{flex:1,backgroundColor:C.bg},
 header:{borderBottomWidth:1,borderColor:C.border,padding:18,gap:7},
 back:{color:C.cyan,fontWeight:'700',fontSize:13,marginBottom:8},
 title:{fontSize:22,color:C.text,fontWeight:'900'},
 muted:{color:C.muted,fontSize:12,lineHeight:18},
 content:{padding:20,paddingBottom:60},
 label:{fontSize:12,fontWeight:'800',letterSpacing:1.2,color:C.cyan,marginTop:20,marginBottom:10},
 input:{backgroundColor:C.panel,color:C.text,borderRadius:9,borderColor:C.border,borderWidth:1,paddingHorizontal:12,height:48,marginTop:10,fontSize:15},
 action:{backgroundColor:'#126399',padding:15,borderRadius:9,alignItems:'center',marginTop:12},
 actionText:{color:C.text,fontWeight:'900',fontSize:13},
 choice:{padding:13,backgroundColor:C.panel,borderWidth:1,borderColor:C.border,borderRadius:10,marginBottom:8,gap:4},
 selected:{borderColor:C.cyan},
 choiceText:{color:C.text,fontWeight:'700',fontSize:15},
 subTitle:{color:C.text,fontSize:17,fontWeight:'800',marginBottom:10},
 panel:{marginTop:15,marginBottom:15,padding:16,backgroundColor:'#102a43',borderRadius:13},
 member:{flexDirection:'row',alignItems:'center',gap:12,paddingVertical:13,borderBottomColor:C.border,borderBottomWidth:1},
 remove:{color:'#ffacac',fontWeight:'800'},
 success:{color:'#4cf07b',fontWeight:'700',marginTop:16},
 error:{color:C.error,marginTop:16},
 warning:{color:'#f9d67b',lineHeight:20},
 small:{color:C.muted,fontSize:11,marginTop:25,lineHeight:18}
});
