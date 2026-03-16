export function validatePasswordPolicy(pw){
  if(!pw || pw.length < 14) return {ok:false,message:'Le mot de passe doit contenir au moins 14 caractères.'}
  if(!/[A-Z]/.test(pw)) return {ok:false,message:'Doit contenir une majuscule.'}
  if(!/[a-z]/.test(pw)) return {ok:false,message:'Doit contenir une minuscule.'}
  if(!/\d/.test(pw)) return {ok:false,message:'Doit contenir un chiffre.'}
  if(!/[!@#$%^&*()_+\-=[\]{};:\"\\|,.<>/?]/.test(pw)) return {ok:false,message:'Doit contenir un caractère spécial.'}
  return {ok:true}
}
