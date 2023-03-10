// Copyright (c) 2022 Siemens

/**
 * Service used for vis viewer functionalities
 *
 * @module js/swiVisViewerUtilityService
 */

let exports = {};
export let swiViewerInstanceId;

/**
  * Update Vis Viewer Instance Id
  * @param {String} instanceId instanceId
  * @param {object} data data
  * @param {String} viewerId viewerId
  */
export let updateVisViewerInstanceId = ( instanceId, data, viewerId ) => {
    data.visContext.id = instanceId;
    if ( viewerId === 'SwiViewer' ) {
        swiViewerInstanceId = instanceId;
    }
};

/**
  * Get Vis Viewer Instance Id
  * @param {String} viewerId viewerId
  * @returns {String} vis viewer id
  */
export let getVisInstanceId = ( viewerId ) => {
    if ( swiViewerInstanceId && viewerId === 'SwiViewer' ) {
        return swiViewerInstanceId;
    }
    return undefined;
};


export default exports = {
    getVisInstanceId,
    updateVisViewerInstanceId
};
