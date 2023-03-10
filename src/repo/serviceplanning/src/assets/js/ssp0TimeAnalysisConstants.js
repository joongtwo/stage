// @<COPYRIGHT>@
// ==================================================
// Copyright 2022.
// Siemens Product Lifecycle Management Software Inc.
// All Rights Reserved.
// ==================================================
// @<COPYRIGHT>@

/**
 *
 * @module js/ssp0TimeAnalysisConstants
 */
'use strict';

export const constants = {
    //Types
    TYPE_Activity: 'MEActivity',
    TYPE_Activity_Line: 'CfgActivityLine',

    //Process Types
    TYPE_WORK_CARD_PROCESS: 'SSP0BvrWorkCard',

    //Messages
    MSG_ACTIVITY_CREATED :'newActivityCreated',

    //Properties
    BOMLINE_WORK_TIME: 'bl_me_work_time',
    BOMLINE_DURATION_TIME: 'bl_me_duration_time',
    ACTIVITY_WORK_TIME :'al_activity_work_time',
    ACTIVITY_DURATION_TIME: 'al_activity_duration_time'


};

export default { constants };
