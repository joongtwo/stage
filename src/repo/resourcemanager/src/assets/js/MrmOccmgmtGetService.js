// Copyright (c) 2022 Siemens

/**
 * @module js/MrmOccmgmtGetService
 */
import AwFilterService from 'js/awFilterService';
import soaSvc from 'soa/kernel/soaService';
import clientDataModelSvc from 'soa/kernel/clientDataModel';
import appCtxService from 'js/appCtxService';
import AwPromiseService from 'js/awPromiseService';
import mrmOccmgmtGetOccsResponseService from 'js/MrmOccmgmtGetOccsResponseService';
import occmgmtRequestPrefPopulatorService from 'js/occmgmtRequestPrefPopulatorService';
import dateTimeService from 'js/dateTimeService';
import _ from 'lodash';
import occmgmtUtils from 'js/occmgmtUtils';

var _NULL_ID = 'AAAAAAAAAAAAAA';

var IModelObject = function( uid, type ) {
    this.uid = uid;
    this.type = type;
};

var _convertDate = function( dateInEpochFormat ) {
    if( !dateInEpochFormat || dateInEpochFormat < 0 ) {
        return dateTimeService.NULLDATE;
    }
    return AwFilterService.instance( 'date' )( dateInEpochFormat, 'yyyy-MM-dd' ) + 'T' +
        AwFilterService.instance( 'date' )( dateInEpochFormat, 'HH:mm:ssZ' );
};

var _populateFocusOccurrenceInputParameters = function( inputData, occContext ) {
    /**
     * Check if the 'focus' has not been set yet.
     */
    if( _.isEmpty( inputData.resourceFocusOccurrenceInput ) ) {
        if( occContext.currentState.c_csid ) {
            inputData.resourceFocusOccurrenceInput.cloneStableIdChain = occContext.currentState.c_csid;
        } else {
            if( //
                clientDataModelSvc.isValidObjectUid( occContext.currentState.c_uid ) && //
                clientDataModelSvc.isValidObjectUid( occContext.currentState.o_uid ) && //
                clientDataModelSvc.isValidObjectUid( inputData.parentElement ) && //
                occContext.currentState.c_uid !== occContext.currentState.o_uid && //
                occContext.currentState.c_uid !== occContext.currentState.t_uid ) {
                /**
                 * Note: We only want to set a 'focus' when we have all the correct 'parent' information.
                 */
                inputData.resourceFocusOccurrenceInput.element = occmgmtUtils.getObject( occContext.currentState.c_uid );
            }
        }
    }
};

var _populateCursorParameters = function( cursor, loadInput ) {
    if( loadInput.cursorObject ) {
        _.assign( cursor, loadInput.cursorObject );
    } else if( loadInput.parentNode && loadInput.parentNode.cursorObject ) {
        _.assign( cursor, loadInput.parentNode.cursorObject );
    } else {
        /**
         * Going forward, we need need to use cursor information here if it is a scroll case.
         * <P>
         * If we use cursor, it will bring next set of children.
         * <P>
         * For normal expand (expand collapse expand use case), where user expects to see first page again, doing
         * scroll there doesn't make sense. We need information from CFX where it is scroll case or expand case
         */
        cursor.startReached = false;
        cursor.endReached = false;
        cursor.startIndex = loadInput.startChildNdx;
        cursor.endIndex = 0;
        cursor.pageSize = loadInput.pageSize;
        // We can not pass clientDataModelSvc.NULL_UID in startOccUid and endOccUid for following reason
        // 1. These are not uid they are pfuid from RTT_BOMLINE. specialized RM DFS mechanism for doing pagination.
        // 2. platform Requirement Management does not check for NULL_UID. They check for empty string ("")
        // 3. RM is implementing null uid check in server occmgmt layer to translate NULL_UID to "". Till they are done we need to continue passing empty string
        // 4. As of now passing NULL_UID causes server hang in flat navigation use-cases for 11.3 and above.
        cursor.startOccUid = '';
        cursor.endOccUid = '';
    }
};

// eslint-disable-next-line complexity
var _populateConfigurationParameters = function( config, currentContext, occContext ) {
    if( !config.hasOwnProperty( 'productContext' ) ) {
        config.productContext = occmgmtUtils.getObject( occContext.currentState.pci_uid );
    }

    var pci;

    if( occContext && !_.isEmpty( occContext.configContext ) ) {
        var configContext = occContext.configContext;

        if( !_.isEmpty( configContext ) ) {
            config.endItem = occmgmtUtils.getObject( configContext.ei_uid );
            config.revisionRule = occmgmtUtils.getObject( configContext.r_uid );
            if( configContext.rev_sruid ) {
                config.serializedRevRule = configContext.rev_sruid;
            } else if( config.revisionRule.serializedRevRule ) {
                config.serializedRevRule = config.revisionRule.serializedRevRule;
            }

            config.svrOwningProduct = occmgmtUtils.getObject( configContext.iro_uid );

            if( clientDataModelSvc.isValidObjectUid( configContext.var_uid ) ) {
                config.variantRules = [ occmgmtUtils.getObject( configContext.var_uid ) ];
            }

            if( configContext.var_uids ) {
                config.variantRules = [];
                for( var i = 0; i < configContext.var_uids.length; i++ ) {
                    if( clientDataModelSvc.isValidObjectUid( configContext.var_uids[ i ] ) ) {
                        config.variantRules[ i ] = occmgmtUtils.getObject( configContext.var_uids[ i ] );
                    }
                }
            }

            // Add effectivityGroups
            if( configContext.eg_uids ) {
                config.effectivityGroups = [];
                for( var i = 0; i < configContext.eg_uids.length; i++ ) {
                    if( clientDataModelSvc.isValidObjectUid( configContext.eg_uids[ i ] ) ) {
                        config.effectivityGroups[ i ] = occmgmtUtils.getObject( configContext.eg_uids[ i ] );
                    }
                }
            }

            // Add Closure Rules
            if( configContext.cl_uid ) {
                if( clientDataModelSvc.isValidObjectUid( configContext.cl_uid ) ) {
                    config.closureRule = occmgmtUtils.getObject( configContext.cl_uid );
                }
            } else if( clientDataModelSvc.isValidObjectUid( occContext.currentState.pci_uid ) ) {
                pci = occmgmtUtils.getObject( occContext.currentState.pci_uid );
                if( pci && pci.props && pci.props.awb0ClosureRule ) {
                    var closureRuleUid = pci.props.awb0ClosureRule.dbValues[ 0 ];
                    if( clientDataModelSvc.isValidObjectUid( closureRuleUid ) ) {
                        config.closureRule = occmgmtUtils.getObject( closureRuleUid );
                    }
                }
            }

            // Add applied arrangement
            if( configContext.ar_uid ) {
                config.appliedArrangement = occmgmtUtils.getObject( configContext.ar_uid );
            }
            // Add View Types
            if( configContext.vt_uid ) {
                config.viewType = occmgmtUtils.getObject( configContext.vt_uid );
            }

            if( clientDataModelSvc.isValidObjectUid( configContext.org_uid ) ) {
                config.occurrenceScheme = occmgmtUtils.getObject( configContext.org_uid );
            } else if( clientDataModelSvc.isValidObjectUid( occContext.currentState.pci_uid ) ) {
                pci = occmgmtUtils.getObject( occContext.currentState.pci_uid );

                if( pci.props.fgf0PartitionScheme ) {
                    config.occurrenceScheme = pci.props.fgf0PartitionScheme;
                }
            }

            if( clientDataModelSvc.isValidObjectUid( configContext.baselinerev_uid ) ) {
                config.sourceContext = occmgmtUtils.getObject( configContext.baselinerev_uid );
            }

            if( configContext.de ) {
                config.effectivityDate = _convertDate( configContext.de );
            }

            config.unitNo = configContext.ue ? parseInt( configContext.ue ) : -1;

            var startDate = configContext.startDate;
            var fromUnit = configContext.fromUnit;
            var intentFormula = configContext.intentFormula;

            if( startDate || fromUnit || intentFormula ) {
                config.effectivityRanges = [];

                var effectivityRange = {};

                effectivityRange.dateIn = startDate;
                effectivityRange.dateOut = configContext.endDate;
                effectivityRange.unitIn = isNaN( fromUnit ) ? -1 : parseInt( fromUnit );
                effectivityRange.unitOut = isNaN( configContext.toUnit ) ? -1 : parseInt( configContext.toUnit );
                if( !_.isUndefined( intentFormula ) ) { //user has explicity applied the intent
                    effectivityRange.intentFormula = configContext.intentFormula;
                } else if( clientDataModelSvc.isValidObjectUid( occContext.currentState.pci_uid ) ) { //Intent is already applied and then user is changing the other configuration then pass the already applied intent
                    pci = occmgmtUtils.getObject( occContext.currentState.pci_uid );
                    if( pci && !_.isEmpty( pci ) && pci.props && pci.props.fgf0IntentFormulaList ) { //Needed this check for refresh scenario
                        effectivityRange.intentFormula = pci.props.fgf0IntentFormulaList.dbValues[ 0 ];
                    } else {
                        effectivityRange.intentFormula = '';
                    }
                } else {
                    effectivityRange.intentFormula = '';
                }

                config.effectivityRanges[ 0 ] = effectivityRange;
            }
        }
    }

    // Change context modified in configuration panel
    var changeContext;
    if( appCtxService.ctx.changeContext ) {
        changeContext = appCtxService.ctx.changeContext;
        if( clientDataModelSvc.isValidObjectUid( changeContext.uid ) ) {
            config.changeContext = changeContext;
        }
    } else {
        // Retain change context when other config parameters changed
        if( clientDataModelSvc.isValidObjectUid( occContext.currentState.pci_uid ) ) {
            pci = occmgmtUtils.getObject( occContext.currentState.pci_uid );
        } else if( currentContext.productContextInfo ) {
            pci = occmgmtUtils.getObject( currentContext.productContextInfo.uid );
        }
    }
};

var exports = {};

/**
 * @param {ResourceLoadInput} loadInput - Object containing specific loading parameters and options.
 * @param {ResourceOccurrencesData} soaInput - Input structure to getResourceOccurrences() SOA.
 * @param {CurrentAppContext} currentContext - Input current context
 * @param {Object} occContext occContext
 * @returns {ResourceOccurrencesResp} - Response from getResourceOccurrences() SOA.
 */
export let getOccurrences = function( loadInput, soaInput, currentContext, occContext ) {
    var inputData = soaInput.inputData;

    if( currentContext.packMode && currentContext.packMode === 1 ) {
        //It means similar elements should not be packed
        if( inputData.requestPref.packSimilarElements ) {
            inputData.requestPref.packSimilarElements[0] = 'false';
        }
    }

    if( appCtxService.getCtx( 'systemLocator' ) ) {
        occmgmtRequestPrefPopulatorService.populateRequestPrefParametersForLocator( inputData.requestPref,
            loadInput, currentContext );
    } else {
        inputData.product = occmgmtUtils.getObject( occContext.currentState.uid );

        inputData.parentElement = loadInput.parentElement;

        _populateConfigurationParameters( inputData.config, currentContext, occContext );

        if( inputData.config.productContext.uid === clientDataModelSvc.NULL_UID && loadInput.productContext ) {
            inputData.config.productContext = loadInput.productContext;
        }
        _populateCursorParameters( inputData.cursor, loadInput );

        if( !loadInput.skipFocusOccurrenceCheck ) {
            _populateFocusOccurrenceInputParameters( inputData, occContext );
            if( inputData.resourceFocusOccurrenceInput.element === undefined && loadInput.focusInput !== null ) {
                inputData.resourceFocusOccurrenceInput.element = occmgmtUtils.getObject( loadInput.focusInput );
            }
        }

        occmgmtRequestPrefPopulatorService.populateRequestPrefParameters( inputData.requestPref, loadInput,
            currentContext, inputData.config, occContext );
        occmgmtRequestPrefPopulatorService.populateExpansionCriteriaParameters( inputData.expansionCriteria, currentContext );
    }
    if( currentContext ) {
        currentContext.getOccInput = soaInput;
        currentContext.transientRequestPref = {};
        appCtxService.updatePartialCtx( occContext.viewKey, currentContext );
    }
    return soaSvc.postUnchecked( 'Internal-ResourceManager-2019-12-ResourceOccurrencesManagement', 'getResourceOccurrences',
        soaInput ).then( function( response ) {
        var deferred = AwPromiseService.instance.defer();

        if( response.partialErrors || response.ServiceData && response.ServiceData.partialErrors ) {
            mrmOccmgmtGetOccsResponseService.processPartialErrors( response );
        }
        deferred.resolve( response );
        return deferred.promise;
    }, function( error ) {
        mrmOccmgmtGetOccsResponseService.processFailedIndexError( error );
        throw soaSvc.createError( error );
    } );
};

/**
 * @returns {ResourceOccurrencesData} Input structure to getResourceOccurrences() SOA with default values.
 */
export let getDefaultSoaInput = function() {
    return {
        inputData: {
            config: {
                effectivityDate: '0001-01-01T00:00:00',
                unitNo: -1
            },
            cursor: {},
            resourceFocusOccurrenceInput: {},
            requestPref: {
                packSimilarElements: [ 'true' ]
            }
        }
    };
};

export default exports = {
    getOccurrences,
    getDefaultSoaInput
};
