// Copyright (c) 2022 Siemens

/**
 * @module js/addClauseToRevRuleService
 */
import localeSvc from 'js/localeService';
import revisionRuleAdminCtx from 'js/revisionRuleAdminContextService';
import revRuleClauseDisplayTextService from 'js/revRuleClauseDisplayTextService';
import addRevRuleClausePropertyService from 'js/addRevRuleClausePropertyService';
import addReleaseEventClauseProperty from 'js/addReleaseEventClauseProperty';
import plantSolveService from 'js/plantSolveService';
import _ from 'lodash';
import eventBus from 'js/eventBus';

var _localeTextBundle = null;
import occmgmtUtils from 'js/occmgmtUtils';

/**
 * update latest clause property when its updated from widget1
 *
 * @param {Object} data - data to generate clause
 * @returns {bool} data -false
 *
 */
export let generateClauseToAdd = function( data ) {
    var newClause;
    var revRuleEntryKeyToValue = {};
    var displayText;
    var entryType = data.currentlySelectedClause.dbValue;
    switch ( entryType ) {
        case 0: // working
            newClause = {
                entryType: entryType
            };
            addRevRuleClausePropertyService.getUpdatedWorkingClause( data, newClause, true );
            break;
        case 1: //status
            newClause = {
                entryType: entryType
            };
            addRevRuleClausePropertyService.getUpdatedStatusClause( data, newClause, true );
            break;
        case 2: //override
            newClause = {
                entryType: entryType
            };
            addRevRuleClausePropertyService.getUpdatedOverrideClause( data, newClause, true );
            break;
        case 3: //date
            displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, entryType, true );
            if( !data.addClause_date.error ) {
                var dateString = displayText.substring( displayText.indexOf( '(' ) + 1, displayText.indexOf( ')' ) ).trim();
                if( dateString === 'Today' ) {
                    dateString = '';
                }
                revRuleEntryKeyToValue.date = dateString;
                var date = {};
                date.uiValue = data.addClause_date.uiValue;
                date.dbValue = data.addClause_date.dbValue;

                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'date', date );
            }
            revRuleEntryKeyToValue.today = data.addClause_today.dbValue.toString();
            revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'today', data.addClause_today.dbValue );
            newClause = {
                entryType: entryType,
                displayText: displayText,
                revRuleEntryKeyToValue: revRuleEntryKeyToValue,
                groupEntryInfo: {
                    listOfSubEntries: []
                }
            };
            break;
        case 4: //Unit
            displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, entryType, true );
            if( !data.addClause_unit_no.error ) {
                revRuleEntryKeyToValue.unit_no = data.addClause_unit_no.dbValue.toString();
                revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'unit_no', data.addClause_unit_no.dbValue );
            }
            newClause = {
                entryType: entryType,
                displayText: displayText,
                revRuleEntryKeyToValue: revRuleEntryKeyToValue,
                groupEntryInfo: {
                    listOfSubEntries: []
                }
            };
            break;
        case 6: //Precise
            displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, entryType, true );
            newClause = {
                entryType: entryType,
                displayText: displayText,
                revRuleEntryKeyToValue: revRuleEntryKeyToValue,
                groupEntryInfo: {
                    listOfSubEntries: []
                }
            };
            break;
        case 7: //Latest
            displayText = revRuleClauseDisplayTextService.getDisplayTextForClause( data, entryType, true );
            var ctx = revisionRuleAdminCtx.getCtx();
            revRuleEntryKeyToValue.latest = ctx.RevisionRuleAdmin.addClause_latestConfigType.configType.toString();
            newClause = {
                entryType: entryType,
                displayText: displayText,
                revRuleEntryKeyToValue: revRuleEntryKeyToValue,
                groupEntryInfo: {
                    listOfSubEntries: []
                }
            };
            break;
        case 8: //End Item
            newClause = {
                entryType: entryType
            };
            addRevRuleClausePropertyService.getUpdatedEndItemClause( data, newClause, true );
            break;
        case 13: //Release Event
            newClause = {
                entryType: entryType
            };
            addReleaseEventClauseProperty.getUpdatedReleaseEventClause( data, newClause, true );
            break;
        case 14: //Plant Location
            newClause = {
                entryType: entryType
            };
            plantSolveService.getUpdatedPlantLocationClause( data, newClause, true );
            break;
        default:
            break;
    }
    // to check if similar clause alredy exist
    if( newClause !== undefined && newClause.entryType !== undefined ) {
        var clauseCanBeAdded = true;
        if( newClause.entryType !== 3 && newClause.entryType !== 4 && newClause.entryType !== 8 && newClause.entryType !== 13 && newClause.entryType !== 14 ) {
            clauseCanBeAdded = checkClauseAddition( newClause, data );
        }
        if( clauseCanBeAdded ) {
            newClause.modified = true;
        } else {
            newClause = undefined;
        }
    }
    return newClause;
};

function checkClauseAddition( newClause, data ) {
    //TODO -Impi - recheck why subPanelContext on data is used not directly subPanelContext
    let subPanelContext = data.subPanelContext;// && data.subPanelContext.activeView === 'RevisionRuleAdminPanel' ?  data.subPanelContext : data;
    let clauseCanBeAdded = true;
    for( let inx = 0; inx < subPanelContext.nestedNavigationState.clauses.length; inx++ ) {
        let clauseFound = _.isEqual( subPanelContext.nestedNavigationState.clauses[ inx ].displayText, newClause.displayText );
        if( clauseFound ) {
            //if simlilar clause alredy exist then instead of adding new one , select back the existing one
            clauseCanBeAdded = false;
            let newSelection = subPanelContext.nestedNavigationState.clauses[ inx ];
            // let objs = subPanelContext.dataProviders.getRevisionRuleInfoProvider.getViewModelCollection().getLoadedViewModelObjects();
            // subPanelContext.dataProviders.getRevisionRuleInfoProvider.selectionModel.setSelection( objs[inx] );

            let newNestedNavigationState = { ...subPanelContext.nestedNavigationState };
            newNestedNavigationState.selectedClauseIndex = inx;

            subPanelContext.nestedNavigationState.update( newNestedNavigationState );
            break;
        }
    }
    return clauseCanBeAdded;
}
/**
 * ***********************************************************<BR>
 * Define external API<BR>
 * ***********************************************************<BR>
 */
var exports = {};

/**
 * Update the selected clause for RevisableOccurrence structure only if "Latest" clause exist's in the currentlySelectedClause
 *
 * @param {DeclViewModel} data - AddClausesViewModel
 */

export let updateCurrentlySelectedClauseForRevOcc = function( data ) {
    var ctx = revisionRuleAdminCtx.getCtx();
    if( data.subPanelContext.occContext.supportedFeatures.Awb0RevisibleOccurrenceFeature === true ) {
        var addDate = false;
        var addUnit = false;
        var addItem = false;
        var addLatest = false;
        var addReleaseEvent = false;
        var addPlantLocation = false;

        data.subPanelContext.sharedData.clauses.forEach( function( clause ) {
            if( clause.entryType === 3 ) {
                addDate = true;
            } else if( clause.entryType === 4 ) {
                addUnit = true;
            } else if( clause.entryType === 7 ) {
                addLatest = true;
            } else if( clause.entryType === 8 ) {
                addItem = true;
            }else if( clause.entryType === 13 ) {
                addReleaseEvent = true;
            }else if( clause.entryType === 14 ) {
                addPlantLocation = true;
            }
        } );
        let newSharedData = _.cloneDeep( data.subPanelContext.sharedData.value );
        if( addLatest ) {
            if( !addDate ) {
                newSharedData.currentlySelectedClause.dbValue = 3;
                newSharedData.currentlySelectedClause.uiValue = _localeTextBundle.date;
            } else if( !addUnit ) {
                newSharedData.currentlySelectedClause.dbValue = 4;
                newSharedData.currentlySelectedClause.uiValue = _localeTextBundle.unit_no;
            } else if( !addItem ) {
                newSharedData.currentlySelectedClause.dbValue = 8;
                newSharedData.currentlySelectedClause.uiValue = _localeTextBundle.endItemName;
            }else if( !addReleaseEvent ) {
                newSharedData.currentlySelectedClause.dbValue = 13;
                newSharedData.currentlySelectedClause.uiValue = _localeTextBundle.releaseEventName;
            }else if( !addPlantLocation ) {
                newSharedData.currentlySelectedClause.dbValue = 14;
                newSharedData.currentlySelectedClause.uiValue = _localeTextBundle.plantLocationName;
            }

            data.subPanelContext.sharedData.update( newSharedData );
        }
    }
};

export let updateCurrentlySelectedClause = function( nestedNavigation, currentlySelectedClause ) {
    if( currentlySelectedClause.dbValue !== nestedNavigation.currentlySelectedClause.dbValue ) {
        let nestedNavigationNew = _.cloneDeep( nestedNavigation );
        nestedNavigationNew.currentlySelectedClause.dbValue = currentlySelectedClause.dbValue;
        nestedNavigationNew.currentlySelectedClause.entryType = currentlySelectedClause.dbValue;
        nestedNavigationNew.currentlySelectedClause.uiValue = currentlySelectedClause.uiValue;
        nestedNavigation.update( nestedNavigationNew );
    }
};


export let addNewClauseToNavigationState = function( newClause, nestedNavigationState ) {
    if( newClause && newClause.modified ) {
        //updated clause on the nestedNavigation state
        let updatedNestedNavigationState = _.cloneDeep( nestedNavigationState );
        let updatedClauses = _.cloneDeep( nestedNavigationState.clauses );

        //Removing the selected state if it exist to avoid the clause properties section rendering
        updatedClauses.forEach( clause => {
            delete clause.selected;
        } );

        updatedClauses.push( newClause );
        updatedNestedNavigationState.clauses = updatedClauses;
        updatedNestedNavigationState.clauseUpdated = true;
        //Once user add the clause, set the newly added clause index in the selectedClauseIndex field
        updatedNestedNavigationState.selectedClauseIndex = updatedClauses.length - 1;
        updatedNestedNavigationState.currentlySelectedClause.dbValue = newClause.entryType;
        nestedNavigationState.update( updatedNestedNavigationState );
    }
};

/**
 * initialise AddClauses panel clause properties in the context and navigate to AddClauses panel
 *
 *
 */
export let setAddClausePanelData = function( nestedNavigationState ) {
    //TODO - Amruta - this is data mutation - why this did not captured earlier
    var ctx = revisionRuleAdminCtx.getCtx();

    // if( ctx.RevisionRuleAdmin ) {
    //     let revisionRuleAdmin = {};
    //     revisionRuleAdmin.addClause_status = 'Any';
    //     revisionRuleAdmin.addClause_statusConfigType = {
    //         configType: '0',
    //         configDisplay: _localeTextBundle.releasedDate
    //     };
    //     revisionRuleAdmin.addClause_latestConfigType = {
    //         configType: 0,
    //         configDisplay: _localeTextBundle.creationDate
    //     };
    //     revisionRuleAdminCtx.updatePartialCtx('RevisionRuleAdmin',revisionRuleAdmin);
    // }

    if( ctx.RevisionRuleAdmin ) {
        ctx.RevisionRuleAdmin.addClause_status = 'Any';
        ctx.RevisionRuleAdmin.addClause_statusConfigType = {
            configType: '0',
            configDisplay: _localeTextBundle.releasedDate
        };
        ctx.RevisionRuleAdmin.addClause_latestConfigType = {
            configType: 0,
            configDisplay: _localeTextBundle.creationDate
        };
    }
    let updatedNestedNavigationState = _.cloneDeep( nestedNavigationState );
    updatedNestedNavigationState.currentlySelectedClause.dbValue = 0;
    updatedNestedNavigationState.currentlySelectedClause.uiValue = 'Working'; //TODO - take from local
    nestedNavigationState.update( updatedNestedNavigationState );
};

/**
 * update latest clause property when its updated from widget
 *
 * @param {Object} latestConfig - latestConfig widget property
 *
 */
export let upateLatestConfigForAddClauses = function( latestConfig ) {
    var latestConfigType = {
        configType: latestConfig.dbValue,
        configDisplay: latestConfig.uiValue
    };
    revisionRuleAdminCtx.updateRevRuleAdminPartialCtx( 'addClause_latestConfigType', latestConfigType );
};

export let getClausesToAdd = function( clauses, clausesToAddInput, isRevisibleOccurrenceFeature ) {
    var addDate = false;
    var addUnit = false;
    var addItem = false;
    var addReleaseEvent = false;
    var addWorking = false;
    var addStatus = false;
    var addLatest = false;
    var addPlantLocation = false;
    clauses.forEach( function( clause ) {
        if( clause.entryType === 0 ) {
            addWorking = true;
        } else if( clause.entryType === 1 ) {
            addStatus = true;
        } else if( clause.entryType === 3 ) {
            addDate = true;
        } else if( clause.entryType === 4 ) {
            addUnit = true;
        } else if( clause.entryType === 7 ) {
            addLatest = true;
        } else if( clause.entryType === 8 ) {
            addItem = true;
        }else if( clause.entryType === 13 ) {
            addReleaseEvent = true;
        }else if( clause.entryType === 14 ) {
            addPlantLocation = true;
        }
    } );

    var commonClausesToAdd = [ {
        propDisplayValue: _localeTextBundle.working,
        propInternalValue: 0
    },
    {
        propDisplayValue: _localeTextBundle.status,
        propInternalValue: 1
    },
    {
        propDisplayValue: _localeTextBundle.date,
        propInternalValue: 3
    },
    {
        propDisplayValue: _localeTextBundle.unit_no,
        propInternalValue: 4
    },
    {
        propDisplayValue: _localeTextBundle.latest,
        propInternalValue: 7
    },
    {
        propDisplayValue: _localeTextBundle.endItemName,
        propInternalValue: 8
    },
    {
        propDisplayValue: _localeTextBundle.releaseEventName,
        propInternalValue: 13
    },
    {
        propDisplayValue: _localeTextBundle.plantLocationName,
        propInternalValue: 14
    }
    ];

    var specificClausesToAdd = [ {
        propDisplayValue: _localeTextBundle.override,
        propInternalValue: 2
    },
    {
        propDisplayValue: _localeTextBundle.precise,
        propInternalValue: 6
    }
    ];

    let clausesToAdd = _.cloneDeep( clausesToAddInput );
    let ctx = revisionRuleAdminCtx.getCtx();
    if( isRevisibleOccurrenceFeature ) {
        clausesToAdd = commonClausesToAdd;
        if( addLatest ) {
            _.remove( clausesToAdd, function( clause ) {
                return clause.propInternalValue === 0 || clause.propInternalValue === 1 || clause.propInternalValue === 7;
            } );
        } else if( addWorking || addStatus ) {
            _.remove( clausesToAdd, function( clause ) {
                return clause.propInternalValue === 7;
            } );
        }
    } else {
        clausesToAdd = commonClausesToAdd.concat( specificClausesToAdd );
    }
    //Remove release event clause as it is only supported for Revisible Occurrence structures from Tc14.1 onwards.
    //Once release event clause is supported for Item structures, remove this code.
    if( isRevisibleOccurrenceFeature !== true
        || !occmgmtUtils.isMinimumTCVersion( 14, 1 ) ) {
        _.remove( clausesToAdd, function( clause ) {
            return clause.propInternalValue === 13;
        } );
    }

    //Remove plantlocation clause as it is only supported when EP_EnablePlantContext is enable from Tc14.2 onwards.
    if( ctx.preferences.EP_EnablePlantContext === undefined
        || ctx.preferences.EP_EnablePlantContext[0] === 'false' ) {
        _.remove( clausesToAdd, function( clause ) {
            return clause.propInternalValue === 14;
        } );
    }

    //Remove plantlocation clause as it is only supported for Revisible Occurrence structures when EP_EnablePlantContext is true.
    if( ctx.preferences.EP_EnablePlantContext && ctx.preferences.EP_EnablePlantContext[0] === 'true' &&  isRevisibleOccurrenceFeature !== true
    ) {
        _.remove( clausesToAdd, function( clause ) {
            return clause.propInternalValue === 14;
        } );
    }

    _.remove( clausesToAdd, function( clause ) {
        return clause.propInternalValue === 3 && addDate || clause.propInternalValue === 4 && addUnit ||
            clause.propInternalValue === 8 && addItem || clause.propInternalValue === 13 && addReleaseEvent || clause.propInternalValue === 14 && addPlantLocation;
    } );

    return { clausesToAdd };
};

/**
 *  Select the lause
 *
 * @param {Object} dataprovider - dataprovider showing the list of clauses
 * @param {Object} nestedNavigationState - state to retain while navigating across panels
 *
 */
export let setSelectedClauseIndex = function( dataProvider, nestedNavigationState ) {
    let selectedClauseIndex = dataProvider.getSelectedIndexes();
    let loadedVMObjs = dataProvider.getViewModelCollection().getLoadedViewModelObjects();
    let newNestedNavigationState = _.cloneDeep( nestedNavigationState );
    newNestedNavigationState.currentlySelectedClauseOnAddPanelIndex = selectedClauseIndex;
    newNestedNavigationState.currentlySelectedClauseOnAddPanel =  loadedVMObjs[ selectedClauseIndex ];
    nestedNavigationState.update( newNestedNavigationState );
};

/**
 *  Select the lause
 *
 * @param {Object} dataprovider - dataprovider showing the list of clauses
 *
 */
export let selectClause = function( data, nestedNavigationState ) {
    data.dispatch( { path: 'data.currentlySelectedClause.dbValue', value: nestedNavigationState.currentlySelectedClause.dbValue } );
    data.dispatch( { path: 'data.currentlySelectedClause.uiValue', value: nestedNavigationState.currentlySelectedClause.uiValue } );
};

_localeTextBundle = localeSvc.getLoadedText( 'RevisionRuleAdminConstants' );

export default exports = {
    setAddClausePanelData,
    upateLatestConfigForAddClauses,
    getClausesToAdd,
    updateCurrentlySelectedClauseForRevOcc,
    updateCurrentlySelectedClause,
    addNewClauseToNavigationState,
    generateClauseToAdd,
    selectClause,
    setSelectedClauseIndex
};
