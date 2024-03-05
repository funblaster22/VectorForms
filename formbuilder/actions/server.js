import KintoClient from "kinto-http";
import btoa from "btoa";
import uuid from "uuid";

import {addNotification} from "./notifications";
import {getFormID} from "../utils";
import config from "../config";
import {clone} from "../reducers/form";
import {getUid} from "../util/login";


export const FORM_PUBLISH = "FORM_PUBLISH";

export const FORM_PUBLICATION_PENDING = "FORM_PUBLICATION_PENDING";
export const FORM_PUBLICATION_DONE = "FORM_PUBLICATION_DONE";
export const FORM_PUBLICATION_FAILED = "FORM_PUBLICATION_FAILED";

export const FORM_RECORD_CREATION_PENDING = "FORM_RECORD_CREATION_PENDING";
export const FORM_RECORD_CREATION_DONE = "FORM_RECORD_CREATION_DONE";

export const SCHEMA_RETRIEVAL_PENDING = "SCHEMA_RETRIEVAL_PENDING";
export const SCHEMA_RETRIEVAL_DONE = "SCHEMA_RETRIEVAL_DONE";

export const RECORDS_RETRIEVAL_PENDING = "RECORDS_RETRIEVAL_PENDING";
export const RECORDS_RETRIEVAL_DONE = "RECORDS_RETRIEVAL_DONE";

const CONNECTIVITY_ISSUES = "This is usually due to an unresponsive server or some connectivity issues.";

function connectivityIssues(dispatch, message) {
  const msg = message +  " " + CONNECTIVITY_ISSUES;
  dispatch(addNotification(msg, {type: "error"}));
}

/**
 * Return HTTP authentication headers from a given token.
 **/
function getAuthenticationHeaders(token) {
  return {Authorization: "Basic " + btoa(`form:${token}`)};
}

/**
 * Initializes the bucket used to store all the forms and answers.
 *
 * - All authenticated users can create new collections
 * - The credentials used to create this bucket aren't useful anymore after
 *   this function as the user is removed from the permissions.
 **/
function initializeBucket() {
  const api = new KintoClient(
    config.server.remote,
    {headers: getAuthenticationHeaders(uuid.v4())}
  );
  return api.createBucket(config.server.bucket.forms, {
    safe: true,
    permissions: {
      "collection:create": ["system.Authenticated",]
    }
  }).then(() => {
    api.bucket(config.server.bucket.forms).setPermissions({
      "write": []
    },
    {patch: true}); // Do a PATCH request to prevent everyone to be an admin.
  })
  .catch(() => {
    console.debug("Skipping bucket creation, it probably already exist.");
  });
}

/**
 * Publishes a new form and give the credentials to the callback function
 * when it's done.
 *
 * In case a 403 is retrieved, initialisation of the bucket is triggered.
 **/
export function publishForm(callback) {
  const thunk =  (dispatch, getState, retry = true) => {

    const form = getState().form;
    // TODO: don't clone, instead set this as initial form schema
    const schema = form.schema;
    const uiSchema = form.uiSchema;

    // This just caused more issues than was worth, plus Kinto doesn't care about schema

    // Create members field. Not filled when submitting, but populated afterward
    // as per https://rjsf-team.github.io/react-jsonschema-form/docs/json-schema/arrays#uischema-for-array-items
    // schema.properties.members = {
    //   "type": "array",
    //   "items": [
    //     {
    //       "type": "string"
    //     }
    //   ],
    // };
    // uiSchema.members = {
    //   // TODO: despite using hidden, still shows up. Might need to update
    //   "ui:widget": "hidden",
    // };
    // uiSchema["ui:order"].push("members");

    // Remove the "required" property if it's empty.
    if (schema.required && schema.required.length === 0) {
      delete schema.required;
    }

    dispatch({type: FORM_PUBLICATION_PENDING});
    const adminToken = uuid.v4().replace(/-/g, "");

    // Create a client authenticated as the admin.
    const bucket = new KintoClient(
      config.server.remote,
      {headers: getAuthenticationHeaders(adminToken)}
    ).bucket(config.server.bucket.forms);

    // The name of the collection is the user token so the user deals with
    // less different concepts.
    bucket.createCollection(adminToken, {
      data: {schema, uiSchema},
      permissions: {
        "record:create": ["system.Authenticated"]
      }
    })
    .then(({data}) => {
      dispatch({
        type: FORM_PUBLICATION_DONE,
        collection: data.id,
      });
      if (callback) {
        callback({
          collection: data.id,
          adminToken,
        });
      }
    })
    .catch((error) => {
      if (error.response === undefined) {
        throw error;
      }
      // If the bucket doesn't exist, try to create it.
      if (error.response.status === 403 && retry === true) {
        return initializeBucket().then(() => {
          thunk(dispatch, getState, false);
        });
      }
      connectivityIssues(dispatch, "We were unable to publish your form.");
      dispatch({type: FORM_PUBLICATION_FAILED});
    });
  };
  return thunk;
}

/**
 * Submit a new form answer.
 * New credentials are created for each answer.
 **/
export function submitRecord(record, collection, callback) {
  return (dispatch, getState) => {
    dispatch({type: FORM_RECORD_CREATION_PENDING});

    const client = new KintoClient(config.server.remote, {
      headers: getAuthenticationHeaders(uuid.v4())
    });

    // TODO: make `requests` bucket if not exist

    // Submit all form answers under a different users.
    // Later-on, we could persist these userid to let users change their
    // answers (but we're not quite there yet).
    client
    .bucket(config.server.bucket.forms)
    .collection(collection)
    .createRecord(record).then(({data}) => {
      dispatch({type: FORM_RECORD_CREATION_DONE});
      if (callback) {
        callback();
      }
    })
    .catch((error) => {
      connectivityIssues(dispatch, "We were unable to publish your answers");
    });

    client
      .bucket(config.server.bucket.requests)
      .createCollection(getUid(), {
        // TODO: make JSON schema
        // TODO: authenticate & restrict collections:create permission to only authenticated users
        permissions: {
          "record:create": ["system.Everyone"]
        }
      });
  };
}

export function loadSchema(formID, callback, adminId) {
  return (dispatch, getState) => {
    dispatch({type: SCHEMA_RETRIEVAL_PENDING});
    new KintoClient(config.server.remote, {
      headers: getAuthenticationHeaders(adminId ? adminId : "EVERYONE")
    })
    .bucket(config.server.bucket.forms)
    .collection(formID)
    .getData().then((data) => {
      dispatch({
        type: SCHEMA_RETRIEVAL_DONE,
        data,
      });
      if (callback) {
        callback(data);
      }
    })
    .catch((error) => {
      console.error(error);
      connectivityIssues(dispatch, "We were unable to load your form");
    });
  };
}

/**
 * Retrieve all the answers to a specific form.
 *
 * The formID is derived from the the adminToken.
 **/
export function getRecords(adminToken, callback) {
  return (dispatch, getState) => {
    dispatch({type: RECORDS_RETRIEVAL_PENDING});
    new KintoClient(config.server.remote, {
      headers: getAuthenticationHeaders(adminToken)
    })
    .bucket(config.server.bucket.forms)
    .collection(adminToken)
    .listRecords().then(({data}) => {
      dispatch({
        type: RECORDS_RETRIEVAL_DONE,
        records: data
      });
      if (callback) {
        callback(data);
      }
    })
    .catch((error) => {
      connectivityIssues(
        dispatch,
        "We were unable to retrieve the list of records for your form."
      );
    });
  };
}

function editResponse(formId, newRecord) {
  return new KintoClient(config.server.remote, {
    headers: getAuthenticationHeaders(uuid.v4())
  })
    .bucket(config.server.bucket.forms)
    .collection(formId)
    .updateRecord(newRecord)
    .then(location.reload.bind(location));
}

/*async function getInviteId(formId, to, from) {
  return formId + from;
}

export function inviteExists(formId, to, from) {
  return new KintoClient(config.server.remote, {
    headers: getAuthenticationHeaders(uuid.v4())
  })
    .bucket(config.server.bucket.requests)
    .collection(to)
    .getRecord(getInviteId(formId, to, from));
}

export function deleteInvite(formId, to, from) {
  return new KintoClient(config.server.remote, {
    headers: getAuthenticationHeaders(uuid.v4())
  })
    .bucket(config.server.bucket.requests)
    .collection(to)
    .deleteRecord(getInviteId(formId, to, from));
}

export function sendInvite(formId, to) {
  const from = getUid();
  return new KintoClient(config.server.remote, {
    headers: getAuthenticationHeaders(uuid.v4())
  })
    .bucket(config.server.bucket.requests)
    .collection(to)
    .createRecord({
      id: formId + from,
      formId,
      from
    });
}*/

export function dropMember(formId, memberId, oldRecord) {
  if (!oldRecord.members) {
    return;
  }
  oldRecord.members.splice(oldRecord.members.indexOf(memberId), 1);
  return editResponse(formId, oldRecord);
}

export function addMember(formId, memberId, oldRecord) {
  if (!oldRecord.members) {
    oldRecord.members = [memberId];
  } else {
    oldRecord.members.push(memberId);
  }
  return editResponse(formId, oldRecord);
}
