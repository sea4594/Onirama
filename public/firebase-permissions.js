// Permission-denied on a room write usually means the deployed Firestore policy
// is out of sync with firestore.rules. A Pages push cannot deploy that policy.
export function explainRoomPermissionError(err,operation='update'){
  if(err?.code!=='permission-denied')return err;
  const action={setup:'changing expansions',start:'starting the game',ready:'changing readiness',restart:'restarting the game',play:'playing a turn'}[operation]||'updating the room';
  const result=new Error(`Firebase denied ${action}. Confirm you are using the correct lobby seat and that firestore.rules has been deployed to the onirama-5124e Firestore database. GitHub Pages updates alone do not publish Firestore rules.`);
  result.code=err.code;
  result.cause=err;
  return result;
}
