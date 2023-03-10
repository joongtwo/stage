// Copyright (c) 2022 Siemens

/**
 *
 * @module js/Pgp0AddPlanLevel
 */
import dateTimeSvc from 'js/dateTimeService';
import appCtxSvc from 'js/appCtxService';
import cmm from 'soa/kernel/clientMetaModel';
import cdm from 'soa/kernel/clientDataModel';
import tcServerVersion from 'js/TcServerVersion';
import eventBus from 'js/eventBus';
import AwPromiseService from 'js/awPromiseService';
import soaService from 'soa/kernel/soaService';
import parsingUtils from 'js/parsingUtils';
import listBoxService from 'js/listBoxService';
import saveAsService from 'js/Awp0ShowSaveAsService';
import uwPropertySvc from 'js/uwPropertyService';

var exports = {};
var getInitialLOVValueDeferred2 = null;

export let createStyleSheet = function( data ) {
    var destPanelId = 'CreateProjectSub';
    appCtxSvc.ctx.programPlanningContext.type1 = data.dataProviders.awTypeSelector.selectedObjects[ '0' ].props.type_name.dbValue;
    appCtxSvc.ctx.programPlanningContext.TypeTitle = data.dataProviders.awTypeSelector.selectedObjects[ '0' ].cellHeader1;
    var activePanel = data.getSubPanel( data.activeView );
    if( activePanel ) {
        activePanel.contextChanged = true;
    }
    var context = {
        destPanelId: destPanelId
    };

    eventBus.publish( 'awPanel.navigate', context );
};

var getSelectedType = function() {
    if( appCtxSvc.ctx.pselected ) {
        return appCtxSvc.ctx.pselected.type;
    } else if( appCtxSvc.ctx.selected ) {
        return appCtxSvc.ctx.selected.type;
    }
};

/**
 * Return input for clonePlanHierarchyWithProject SOA
 *
 * @param {object} data - Data of ViewModelObject
 */
export let clonePlanHierarchyWithProjectInput = function( data ) {
    var ctxObj = appCtxSvc.ctx.selected;
    var propertyMap = {
        object_name: data.object_name.dbValue,
        object_desc: data.object_desc.dbValue
    };

    var date;
    var dateValue;
    if( data.dcdDateTime ) {
        date = new Date( data.dcdDateTime.dateApi.dateObject );
        dateValue = dateTimeSvc.formatUTC( date );
    }

    var saveAsInputIn;
    var targetUid;
    var InfoMap;
    var OptionsMap;
    var programDeliverable;
    var checklist;

    if( data.isSupported  ) {
        for( var lovMap in data.MapoflovValues ) {
            if( data.target_program && data.target_program.dbValue ) {
                var index = data.target_program.dbValue.indexOf( '-' );
                var targetProgramId = data.target_program.dbValue.substring( 0, index - 1 );
                if( targetProgramId === data.MapoflovValues[ lovMap ].propDisplayValues.prg0PlanId[ 0 ] ) {
                    targetUid = data.MapoflovValues[ lovMap ].uid;
                    break;
                }
            }
        }
        InfoMap = {
            CurrentSelection: {
                type: ctxObj.type,
                uid: ctxObj.uid
            },
            TargetProgram: {
                type: getSelectedType(),
                uid: targetUid
            }
        };
        if( data.program_deliverable && typeof data.program_deliverable.dbValue === 'undefined' ) {
            programDeliverable = 'false';
        } else {
            programDeliverable = 'true';
        }
        checklist = 'true';
        if( data.checklist && typeof data.checklist.dbValue === 'undefined' ) {
            checklist = 'false';
        }
        OptionsMap = {
            includeProgramDeliverable: programDeliverable,
            includeChecklist: checklist
        };
    } else {
        InfoMap = {
            CurrentSelection: {
                type: ctxObj.type,
                uid: ctxObj.uid
            },
            TargetProgram: {
                type: ctxObj.type,
                uid: ctxObj.uid
            }
        };

        if( data.program_deliverable && typeof data.program_deliverable.dbValue === 'undefined' ) {
            programDeliverable = 'false';
        } else {
            programDeliverable = 'true';
        }
        checklist = 'true';
        if( data.checklist && typeof data.checklist.dbValue === 'undefined' ) {
            checklist = 'false';
        }
        OptionsMap = {
            includeProgramDeliverable: programDeliverable,
            includeChecklist: checklist
        };
    }
    //Prepare SaveAs input
    saveAsInputIn = [ {
        cloneInfoMap: InfoMap,
        cloneOptionsMap: OptionsMap,
        primeEventDate: dateValue,
        propertyValuesMap: propertyMap
    } ];

    return {
        targetUid: targetUid,
        saveAsInputIn: saveAsInputIn
    };
};

/**
 * Return input for clonePlanHierarch SOA
 *
 * @param {object} data - Data of ViewModelObject
 */
export let clonePlanHierarchyInput = function( data ) {
    var ctxObj = appCtxSvc.ctx.selected;
    var propertyMap = {
        object_name: data.object_name.dbValue,
        object_desc: data.object_desc.dbValue
    };

    var date = new Date( data.dcdDateTime.dateApi.dateObject );
    var dateValue;
    dateValue = dateTimeSvc.formatUTC( date );
    var saveAsInputIn;
    //Prepare SaveAs input
    saveAsInputIn = [ {
        planObject: ctxObj,
        primeEventDate: dateValue,
        propertyValueMap: propertyMap
    } ];
    return saveAsInputIn;
};

export let refreshTimelineOnCloneProjectWithSameTarget = function( data ) {
    if( typeof data.returnedObject.targetUid !== typeof undefined ) {
        var typeOfOpenedObject = appCtxSvc.ctx.locationContext.modelObject.modelType;
        var uidOfOpenedObject = appCtxSvc.ctx.locationContext.modelObject.uid;
        if( cmm.isInstanceOf( 'Prg0AbsProgramPlan', typeOfOpenedObject ) ) {
            return uidOfOpenedObject === data.returnedObject.targetUid;
        }
    }
    return false;
};

/**
 * Get domain list
 */
export let getDomainList = function( response ) {
    var domainList = [];

    for( var lovValRow in response.lovValues ) {
        if( response.lovValues.hasOwnProperty( lovValRow ) ) {
            var targetProgram = response.lovValues[ lovValRow ].propDisplayValues.prg0PlanId[ 0 ] + ' - ' +
                response.lovValues[ lovValRow ].propDisplayValues.object_name[ 0 ];
            domainList.push( targetProgram );
        }
    }

    return domainList;
};

/**
 * Checks whether TC server version is greater than or equal to TC11.2.3
 */
export let checkForVersionSupportForProject = function() {
    if( tcServerVersion.majorVersion > 11 ) {
        // For TC versions like TC12
        return true;
    }
    if( tcServerVersion.majorVersion < 11 ) {
        // For TC versions like TC10
        return false;
    }
    if( tcServerVersion.minorVersion > 2 ) {
        // For TC versions like TC11.3
        return true;
    }
    if( tcServerVersion.minorVersion < 2 ) {
        // For TC versions like TC11.1
        return false;
    }
    //compare only versions like TC11.2.2, TC11.2.3....
    return tcServerVersion.qrmNumber >= 3;
};

var isChildOfProgramPlan = function() {
    if( appCtxSvc.ctx.mselected[ 0 ].props.prg0ParentPlan !== undefined ) {
        var parentObjUid = appCtxSvc.ctx.mselected[ 0 ].props.prg0ParentPlan.dbValues[ 0 ];
        if( parentObjUid !== null ) {
            var parentPlanObj = cdm.getObject( parentObjUid );
            var typeOfSelectedObject = parentPlanObj.modelType;
            if( cmm.isInstanceOf( 'Prg0AbsProgramPlan', typeOfSelectedObject ) ||
                cmm.isInstanceOf( 'Prg0AbsProjectPlan', typeOfSelectedObject ) ) {
                return true;
            }
            return false;
        }
        return false;
    }
    return false;
};

/**
 * Generate the next LOV values when user is doing pagination in LOV.
 * @param {deferred} deferred - $q object to resolve the 'promise' with a an array of LOVEntry objects.
 * @param {Object} prop Property object
 * @param {String} filterContent Filter content string
 * @param {String} filterStr Filter string
 * @returns {Promise} The Prmoise for performUserSearchByGroup
 */
var getNextLOVValues = function( deferred, prop, filterContent, filterStr ) {
    var lovEntries = [];
    if ( prop.moreValuesExist ) {
        var startIdx = prop.endIndex;
        exports.performUserSearchByGroup( prop, startIdx, filterContent, filterStr ).then( function( validObjects ) {
            lovEntries = validObjects;
            deferred.resolve( lovEntries );
        } );
    } else {
        deferred.resolve( lovEntries );
    }
    return deferred.promise;
};

/**
 * Return for version support check and child of ProgramPlan check
 *
 * @param {object} data - Data of ViewModelObject
 */
export let populateData = function( data ) {
    var versionSupported = exports.checkForVersionSupportForProject();
    var programPlanchild = isChildOfProgramPlan();
    data.isTcVersionSupported = versionSupported;
    data.isProgramPlanchild = programPlanchild;
};

/**
 * Get the user content based on input values and created LOV entries and return.
 *
 * @param {Object} prop Property obejct whose properties needs to be populated
 * @param {int} startIndex Start index value
 * @param {Object} filterContent Filter content object that can be filter user
 * @param {Object} filterStr Filter string to filter group or user. This is when user is tryong on LOV
 *
 * @returns {Promise} Promise object
 */
export let performUserSearchByGroup = function( prop, startIndex, filterContent, filterStr ) {
    var deferred = AwPromiseService.instance.defer();
    var contentType = prop.contentType;
    var searchCriteria = {
        resourceProviderContentType: contentType
    };
    if ( contentType === 'Users' && filterContent ) {
        searchCriteria.group = filterContent;
    }
    if ( filterStr ) {
        searchCriteria.searchString = filterStr;
    }

    // Check if sub group need to be search. Pass that value to server
    if ( prop.searchSubGroup ) {
        searchCriteria.searchSubGroup = 'true';
    }
    var resourceProvider = 'Awp0ResourceProvider';
    var inputData = {
        columnConfigInput: {
            clientName: 'AWClient',
            clientScopeURI: ''
        },
        inflateProperties: false,
        saveColumnConfigData: {},
        searchInput: {
            maxToLoad: 50,
            maxToReturn: 50,
            providerName: resourceProvider,
            searchCriteria: searchCriteria,
            cursor: {
                startIndex: startIndex,
                endReached: false,
                startReached: false,
                endIndex: 0
            },
            searchSortCriteria: [],
            searchFilterFieldSortType: 'Alphabetical'
        }
    };

    // SOA call made to get the content
    soaService.post( 'Internal-AWS2-2019-06-Finder', 'performSearchViewModel4', inputData ).then( function( response ) {
        var lovEntries = [];
        var modelObjects = [];
        if( response.searchResultsJSON ) {
            var searchResults = parsingUtils.parseJsonString( response.searchResultsJSON );
            if( searchResults ) {
                for( var i = 0; i < searchResults.objects.length; i++ ) {
                    var uid = searchResults.objects[ i ].uid;
                    var obj = response.ServiceData.modelObjects[ uid ];
                    modelObjects.push( obj );
                }
            }
            // Create the list model object that will be displayed
            var groups = listBoxService.createListModelObjects( modelObjects, 'props.object_string' );
            Array.prototype.push.apply( lovEntries, groups );
        }
        var endIndex = response.cursor.endIndex;
        var moreValuesExist = !response.cursor.endReached;
        if ( endIndex > 0 && moreValuesExist ) {
            endIndex += 1;
        }
        prop.endIndex = endIndex;
        prop.moreValuesExist = moreValuesExist;
        deferred.resolve( lovEntries );
    } );

    return deferred.promise;
};

/**
 * This operation is invoked to query the data for a property having an LOV attachment. The results returned
 * from the server also take into consideration any filter string that is in the input. This method calls
 * 'getInitialLOVValues' and returns initial set of lov values.
 *
 * @param {filterString} data - The view model
 * @param {deferred} deferred - $q object to resolve the 'promise' with a an array of LOVEntry objects.
 * @param {ViewModelProperty} prop - Property to aceess LOV values for.
 * @param {String} filterContent Filter content string
 * @param {String} defaultString To be populate on group or user LOV
 * @param {String} filterStr Filter string
 */
var getInitialLOVValues = function( data, deferred, prop, filterContent, defaultString, filterStr ) {
    if ( !getInitialLOVValueDeferred2 ) {
        getInitialLOVValueDeferred2 = deferred;
        var lovValues = [];
        exports.performUserSearchByGroup( prop, 0, filterContent, filterStr ).then( function( validObjects ) {
            if ( validObjects ) {
                lovValues = listBoxService.createListModelObjectsFromStrings( [ defaultString ] );
                // Create the list model object that will be displayed
                Array.prototype.push.apply( lovValues, validObjects );
            }
            deferred.resolve( lovValues );
            getInitialLOVValueDeferred2 = null;
        }, function( reason ) {
            deferred.reject( reason );
            getInitialLOVValueDeferred2 = null;
        } );
    }
};

/**
 * Populate the group LOV values.
 *
 * @param {Object} data Data view model object
 * @param {Object} prop Property object
 */
var populateGroupLOV = function( data, prop ) {
    var parentData = data;
    prop.lovApi = {};
    prop.contentType = 'Group';
    prop.emptyLOVEntry = false;
    prop.lovApi.getInitialValues = function( filterStr, deferred ) {
        getInitialLOVValues( data, deferred, prop, '', data.i18n.allGroups, filterStr );
    };
    prop.lovApi.getNextValues = function( deferred ) {
        var filterStr = null;
        if( !prop.dbValue.uid && prop.uiValue !== data.i18n.allGroups ) {
            filterStr = prop.uiValue;
        }
        getNextLOVValues( deferred, prop, '', filterStr );
    };

    prop.lovApi.validateLOVValueSelections = function( lovEntries ) {
        parentData.groupName = null;
        if ( lovEntries[0].propInternalValue.uid ) {
            parentData.groupName = lovEntries[0].propInternalValue.props.object_full_name.dbValues[0];
            data.groupUID = lovEntries[0].propInternalValue.uid;
        } else {
            // This is needed when user entered some wrong value which is not present
            // then set to default all groups
            prop.dbValue = data.i18n.allGroups;
            prop.uiValue = data.i18n.allGroups;
            data.groupUID = '';
        }

        //reset owning user lov as All Users
        data.allUsers.dbValue = data.i18n.allUsers;
        data.allUsers.uiValue = data.i18n.allUsers;
        data.userUID = '';
        if ( parentData.additionalSearchCriteria ) {
            parentData.additionalSearchCriteria.group = parentData.groupName;
        }
        eventBus.publish( 'awPopupWidget.close', {
            propObject: prop
        } );
    };
};

/**
 * Populate the user LOV values.
 *
 * @param {Object} data Data view model object
 * @param {Object} prop Property object
 */
var populateUserLOV = function( data, prop ) {
    var parentData = data;
    prop.lovApi = {};
    prop.contentType = 'Users';

    // Check if searchSubGroup present on data that means we need
    // to search user inside sub group
    if( data.searchSubGroup ) {
        prop.searchSubGroup = true;
    }

    // This is needed to remove the first empty entry fromn LOV values
    prop.emptyLOVEntry = false;
    prop.lovApi.getInitialValues = function( filterStr, deferred ) {
        getInitialLOVValues( data, deferred, prop, data.groupName, data.i18n.allUsers, filterStr );
    };
    prop.lovApi.getNextValues = function( deferred ) {
        var filterStr = null;
        if( !prop.dbValue.uid && prop.uiValue !== data.i18n.allUsers ) {
            filterStr = prop.uiValue;
        }
        getNextLOVValues( deferred, prop, data.groupName, filterStr );
    };

    prop.lovApi.validateLOVValueSelections = function( lovEntries ) {
        if( lovEntries[ 0 ].propInternalValue.uid ) {
            parentData.userpName = lovEntries[ 0 ].propInternalValue.props.user.uiValues[ 0 ];
            data.userUID = lovEntries[ 0 ].propInternalValue.props.user.dbValues[ 0 ];
        } else {
            prop.dbValue = data.i18n.allUsers;
            prop.uiValue = data.i18n.allUsers;
            data.userUID = '';
        }
        if( parentData.additionalSearchCriteria ) {
            parentData.additionalSearchCriteria.user = parentData.userpName;
        }
        eventBus.publish( 'awPopupWidget.close', {
            propObject: prop
        } );
    };
};

/**
 * initialize the initPlanTemplates data provider
 *
 * @param {Object} data Data view model object
 */
export let initDataProvider = function( data ) {
    console.log( ' publish addPlanSubLevel.initPlanTemplates ' );
    let eventData = {};
    eventBus.publish( 'addPlanSubLevel.initPlanTemplates', eventData );
};

/**
 * Sets the selected Event on the view model object
 *
 * @param {Object} data Data view model object
 */
export let getSelectedEvent = function( data ) {
    if( data.dataProviders.performSearch ) {
        let curEvent = data.dataProviders.performSearch.selectedObjects[0];
        if( curEvent ) {
            appCtxSvc.ctx.programPlanningContext.selectedEvent = curEvent;
            return curEvent;
        }
    }
};

/**
 * Sets the selected Event From Palette on the view model object
 *
 * @param {Object} data Data view model object
 */
export let getSelectedEventFromPalette = function( attributes ) {
    appCtxSvc.ctx.programPlanningContext.selectedEvent = attributes[0];
    return attributes[0];
};

/**
 * Removes the selected template from the command context
 *
 * @param {Object} data Data view model object
 */
export let removeTemplateFromProvider = function( commandContext ) {
    commandContext.dataProviders.selectedTemplateProvider.viewModelCollection.loadedVMObjects.pop();
    commandContext.dataProviders.selectedTemplateProvider.selectedObjects.pop();
    delete appCtxSvc.ctx.programPlanningContext.selectedTemplate;
};

/**
 * Updates the context so as to be usable with OOTB Save AS
 *
 * @param {Object} data Data view model object
 * @param {Object} ctx  Context object
 */
let updateContext = function( data, ctx ) {
    if( data.selectedTemplate ) {
        if( ctx.SelectedObjects ) {
            ctx.SelectedObjects[ 0 ] = data.selectedTemplate;
        } else {
            ctx.SelectedObjects = [];
            ctx.SelectedObjects.push( data.selectedTemplate );
        }
    }
    ctx.programPlanningContext.addPlanParent = ctx.selected;
};

/**
 * Updates the context so as to be usable with Event OOTB Save AS
 *
 * @param {Object} data Data view model object
 * @param {Object} ctx  Context object
 */
let updateContextForEvent = function( data, ctx ) {
    if( data.selectedEvent ) {
        if( ctx.SelectedObjects ) {
            ctx.SelectedObjects[ 0 ] = data.selectedEvent;
        } else {
            ctx.SelectedObjects = [];
            ctx.SelectedObjects.push( data.selectedEvent );
        }
    }
    if( ctx.xrtPageContext.primaryXrtPageID === 'tc_xrt_Timeline' ) {
        ctx.programPlanningContext.addPlanParent = ctx.selected;
    } else{
        ctx.programPlanningContext.addPlanParent = ctx.xrtSummaryContextObject;
    }
};

/**
 * Modifies the SaveAs form to set some properties as read only
 *
 * @param {Object} data Data view model object
 * @param {Object} context  Context object
 */
export let modifySaveAsForm = function( data, ctx ) {
    if( data.prg0TargetParentPlan ) {
        if( ctx.xrtPageContext.primaryXrtPageID === 'tc_xrt_Timeline' ) {
            uwPropertySvc.setWidgetDisplayValue( data.prg0TargetParentPlan, ctx.selected.props.object_name.displayValues );
        } else {
            uwPropertySvc.setWidgetDisplayValue( data.prg0TargetParentPlan, ctx.xrtSummaryContextObject.props.object_name.displayValues );
        }
        uwPropertySvc.setIsEnabled( data.prg0TargetParentPlan, false );
    }
    if( data.prg0PlannedDate ) {
        uwPropertySvc.setWidgetDisplayValue( data.prg0PlannedDate, '' );
        uwPropertySvc.setValue(  data.prg0PlannedDate, '' );
    }
};

/**
 *  Execute function to call Remove Event from dataProvider
 */
export let execute = function() {
    eventBus.publish( 'Pgp0CreateEventBasedOn.removeEvent' );
};

/**
 * Service to display Serial and Lot Number Panel.
 *
 * @member Pgp0AddPlanLevel
 * @memberof Pgp0AddPlanLevel
 */

export default exports = {
    createStyleSheet,
    clonePlanHierarchyWithProjectInput,
    clonePlanHierarchyInput,
    refreshTimelineOnCloneProjectWithSameTarget,
    getDomainList,
    checkForVersionSupportForProject,
    populateData,
    initDataProvider,
    performUserSearchByGroup,
    removeTemplateFromProvider,
    modifySaveAsForm,
    getSelectedEvent,
    getSelectedEventFromPalette,
    execute
};
