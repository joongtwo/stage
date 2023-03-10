// Copyright (c) 2022 Siemens

/**
 * @module js/revRuleClauseDisplayTextService
 */
import revisionRuleAdminCtx from 'js/revisionRuleAdminContextService';
import localeService from 'js/localeService';

var ADDCLAUSE_PREFIX = 'addClause_';
var _resource = 'RevisionRuleAdminConstants';
var _localeTextBundle = localeService.getLoadedText( _resource );

/**
 * Get Display Text for working clause
 *
 * @param {boolean} isForAddClause - if modified from AddCluase panel
 * @return {String} displayText - Display Text for working clause
 *
 */
function getWorkingDisplayText( isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var displayText = undefined;
    var user = undefined;
    var user_type = 'User';
    var group_type = 'Group';
    var current_user = false;
    if( isForAddClause ) {
        user_type = ADDCLAUSE_PREFIX + user_type;
        group_type = ADDCLAUSE_PREFIX + group_type;
    }
    if( ctx.RevisionRuleAdmin[ user_type ] && ctx.user ) {
        current_user = ctx.RevisionRuleAdmin[ user_type ].uid === ctx.user.uid;
    }
    var current_group = false;
    if( ctx.RevisionRuleAdmin[ group_type ] && ctx.userSession ) {
        current_group = ctx.RevisionRuleAdmin[ group_type ].uid === ctx.userSession.props.group.dbValue;
    }

    if( ctx.RevisionRuleAdmin[ user_type ] && !current_user ) {
        user = ctx.RevisionRuleAdmin[ user_type ].cellHeader2;
    }

    var group = undefined;
    if( ctx.RevisionRuleAdmin[ group_type ] && !current_group ) {
        group = ctx.RevisionRuleAdmin[ group_type ].props.object_string.dbValue;
    }

    var working = _localeTextBundle.working;
    var owningUser = _localeTextBundle.owningUser;
    var owningGroup = _localeTextBundle.owningGroup;
    var current = _localeTextBundle.current;

    if( user && group ) {
        displayText = working + '( ' + owningUser + ' = ' + user + ', ' + owningGroup + ' = ' + group + ' )';
    } else if( user && !group ) {
        if( current_group ) {
            displayText = working + '( ' + owningUser + ' = ' + user + ', ' + owningGroup + ' = ' + current + ' )';
        } else {
            displayText = working + '( ' + owningUser + ' = ' + user + ' )';
        }
    } else if( group && !user ) {
        if( current_user ) {
            displayText = working + '( ' + owningUser + ' = ' + current + ', ' + owningGroup + ' = ' + group + ' )';
        } else {
            displayText = working + '( ' + owningGroup + ' = ' + group + ' )';
        }
    } else {
        if( current_user && current_group ) {
            displayText = working + '( ' + owningUser + ' = ' + current + ', ' + owningGroup + ' = ' + current + ' )';
        } else if( current_user && !current_group ) {
            displayText = working + '( ' + owningUser + ' = ' + current + ' )';
        } else if( current_group && !current_user ) {
            displayText = working + '( ' + owningGroup + ' = ' + current + ' )';
        } else {
            displayText = working + '(  )';
        }
    }
    return displayText;
}

/**
 * Get Display Text for status clause
 *
 * @param {boolean} isForAddClause - if modified from AddCluase panel
 * @return {String} displayText - Display Text for status clause
 *
 */
function getStatusDisplayText( isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var displayText = undefined;
    var status = 'status';
    var statusConfig = 'statusConfigType';
    var statusType = '';
    if( isForAddClause ) {
        status = ADDCLAUSE_PREFIX + status;
        statusConfig = ADDCLAUSE_PREFIX + statusConfig;
    }

    var anyReleaseStatus = _localeTextBundle.anyReleaseStatus;
    var hasStatus = _localeTextBundle.hasStatus;
    var configuredUsing = _localeTextBundle.configuredUsing;

    if( ctx.RevisionRuleAdmin[ status ] === 'Any' ) {
        statusType = anyReleaseStatus;
    } else {
        statusType = ctx.RevisionRuleAdmin[ status ].cellHeader1;
    }
    var configType = '';
    if( ctx.RevisionRuleAdmin[ statusConfig ] ) {
        configType = ctx.RevisionRuleAdmin[ statusConfig ].configDisplay;
    }
    displayText = hasStatus + '( ' + statusType + ', ' + configuredUsing + ' ' + configType + ' )';
    return displayText;
}

/**
 * Get Display Text for override clause
 *
 * @param {boolean} isForAddClause - if modified from AddCluase panel
 * @return {String} displayText - Display Text for override clause
 *
 */
function getOverrideDisplayText( isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var displayText = undefined;
    var folder_type = 'folder';
    var folder = undefined;
    if( isForAddClause ) {
        folder_type = ADDCLAUSE_PREFIX + folder_type;
    }
    if( ctx.RevisionRuleAdmin[ folder_type ] ) {
        folder = ctx.RevisionRuleAdmin[ folder_type ].props.object_string.dbValue;
    }

    var overrideFolder = _localeTextBundle.overrideFolder;

    if( folder ) {
        displayText = overrideFolder + '( ' + folder + ' )';
    } else {
        displayText = overrideFolder + '( )';
    }
    return displayText;
}

/**
 * Get Display Text for End Item clause
 *
 * @param {boolean} isForAddClause - if modified from AddCluase panel
 * @return {String} displayText - Display Text for End Item clause
 *
 */
function getEndItemDisplayText( isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    var displayText = undefined;
    var endItem = '';
    var endItem_type = 'end_item';
    if( isForAddClause ) {
        endItem_type = ADDCLAUSE_PREFIX + endItem_type;
    }
    if( ctx.RevisionRuleAdmin[ endItem_type ] ) {
        endItem = ctx.RevisionRuleAdmin[ endItem_type ].props.object_string.dbValue;
    }

    var endItemClause = _localeTextBundle.endItemName;
    var none = _localeTextBundle.none;

    if( endItem !== '' ) {
        displayText = endItemClause + '( ' + endItem + ' )';
    } else {
        displayText = endItemClause + '( ' + none + ' )';
    }

    return displayText;
}

function getReleaseEventDisplayText( data, isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();

    var displayText = undefined;
    var event_type = 'Fnd0ReleaseEvent';
    var release_event = undefined;

    if( isForAddClause ) {
        event_type = ADDCLAUSE_PREFIX + event_type;
    }

    if( ctx.RevisionRuleAdmin[ event_type ] ) {
        release_event = ctx.RevisionRuleAdmin[ event_type ].cellHeader1;
    }

    var releaseEventClause = _localeTextBundle.releaseEventName;
    if( release_event !== '' ) {
        displayText = releaseEventClause + '( ' + release_event + ' )';
    } else {
        displayText = String( releaseEventClause + '( ' ) + ' )';
    }

    return displayText;
}


function getPlantLocationDisplayText( data, isForAddClause ) {
    var ctx = revisionRuleAdminCtx.getCtx();

    var displayText = undefined;
    var event_type = 'plantLocation';
    var plantLocation = undefined;

    if( isForAddClause ) {
        event_type = ADDCLAUSE_PREFIX + event_type;
    }

    if( ctx.RevisionRuleAdmin[ event_type ] ) {
        plantLocation = ctx.RevisionRuleAdmin[ event_type ].plantLocationDisplay;
    }

    var plantLocationClause = _localeTextBundle.plantLocationName;
    if( plantLocation !== '' ) {
        displayText = plantLocationClause + '( ' + plantLocation + ' )';
    } else {
        displayText = String( plantLocationClause + '( ' ) + ' )';
    }

    return displayText;
}
/**
 * Get Display Text for Date clause
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {boolean} isForAddClause - if modified from AddCluase panel
 * @return {String} displayText - Display Text for Date clause
 *
 */
function getDateDisplayText( data, isForAddClause, dateField ) {
    var dateText = _localeTextBundle.date;
    var todayText = _localeTextBundle.useToday;

    var displayText = dateText + '( )';
    var date = 'date';
    var today = 'today';
    var timeString = '';
    var dateString = '';
    if( isForAddClause ) {
        date = ADDCLAUSE_PREFIX + date;
        today = ADDCLAUSE_PREFIX + today;
    }
    if( data[ today ].dbValue  === true || data[ today ].dbValue === 'true' ) {
        displayText = dateText + '( ' + todayText + ' )';
    } else if( !data[ date ].error ||  dateField && !dateField.error ) { ///TODO in local run dataFiled not available
        if( data[ date ].dateApi && data[ date ].dateApi.dateObject ) {
            if( data[ date ].dateApi.dateValue ) {
                dateString = data[ date ].dateApi.dateValue.slice( 0, 11 );
            } else {
                return displayText = dateText + '( )';
            }
            if( data[date].dateApi.timeValue !== undefined && data[date].dateApi.timeValue !== '' ) {
                timeString = data[ date ].dateApi.timeValue.slice( 0, 5 );
            }
            //default time
            if( timeString === '' ) {
                timeString = '00:00';
            }
            displayText = dateText + '(' + ( dateString + ' ' + timeString ) + ')';
        }
    }
    return displayText;
}

/**
 * Get Display Text for unit clause
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {boolean} isForAddClause - if modified from AddCluase panel
 * @return {String} displayText - Display Text for unit clause
 *
 */
function getUnitDisplayText( data, isForAddClause ) {
    var displayText = undefined;
    var unit_no = 'unit_no';
    if( isForAddClause ) {
        unit_no = ADDCLAUSE_PREFIX + unit_no;
    }
    var unitNum = '';
    if( !data[ unit_no ].error ) {
        unitNum = data[ unit_no ].dbValue;
    }

    var unitNo = _localeTextBundle.unit_no;
    displayText = unitNo + '( ' + unitNum + ' )';
    return displayText;
}

/**
 * Get Display Text for Latest clause
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {boolean} isForAddClause - if modified from AddCluase panel
 * @return {String} displayText - Display Text for Latest clause
 *
 */
function getLatestDisplayText( data, isForAddClause ) {
    var displayText = undefined;
    var latestConfigType = 'latestConfigType';
    var ctx = revisionRuleAdminCtx.getCtx();
    if( ctx.aceActiveContext.context.supportedFeatures.Awb0RevisibleOccurrenceFeature === true ) {
        latestConfigType = 'latestConfigTypeForRevOcc';
    }
    if( isForAddClause ) {
        latestConfigType = ADDCLAUSE_PREFIX + latestConfigType;
    }
    var latestVal = data[ latestConfigType ].uiValue;

    var latestText = _localeTextBundle.latest;
    displayText = latestText + '( ' + latestVal + ' )';
    return displayText;
}

/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};

/**
 * Get Display Text for clauses
 *
 * @param {DeclViewModel} data - RevisionRuleAdminPanelViewModel
 * @param {Integer} entryType - modified/added clause type
 * @param {boolean} isForAddClause - if modified from AddCluase panel
 * @return {String} displayText - Display Text for Latest clause
 *
 */
export let getDisplayTextForClause = function( data, entryType, isForAddClause, dateField ) {
    var displayText = undefined;
    switch ( entryType ) {
        case 0:
            displayText = getWorkingDisplayText( isForAddClause );
            break;
        case 1:
            displayText = getStatusDisplayText( isForAddClause );
            break;
        case 2:
            displayText = getOverrideDisplayText( isForAddClause );
            break;
        case 3:
            displayText = getDateDisplayText( data, isForAddClause, dateField );
            break;
        case 4:
            displayText = getUnitDisplayText( data, isForAddClause );
            break;
        case 6:
            displayText = 'Precise';
            break;
        case 7:
            displayText = getLatestDisplayText( data, isForAddClause );
            break;
        case 8:
            displayText = getEndItemDisplayText( isForAddClause );
            break;
        case 13:
            displayText = getReleaseEventDisplayText( data, isForAddClause );
            break;
        case 14:
            displayText = getPlantLocationDisplayText( data, isForAddClause );
            break;
        default:
            break;
    }
    return displayText;
};

export default exports = {
    getDisplayTextForClause
};
