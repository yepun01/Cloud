const admin = require("firebase-admin");
const { COLLECTIONS } = require("./config");

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

function pixelDocRef(x, y) {
  return db.doc(`${COLLECTIONS.pixels}/${x}_${y}`);
}

function userDocRef(userId) {
  return db.doc(`${COLLECTIONS.users}/${userId}`);
}

function pixelsCollection() {
  return db.collection(COLLECTIONS.pixels);
}

module.exports = {
  admin,
  db,
  pixelDocRef,
  userDocRef,
  pixelsCollection,
};
