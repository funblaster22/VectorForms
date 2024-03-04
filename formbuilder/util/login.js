import uuid from "uuid";

export function getUid() {
  if (localStorage.uid) {
    return localStorage.uid;
  }
  return (localStorage.uid = uuid.v4());
}
