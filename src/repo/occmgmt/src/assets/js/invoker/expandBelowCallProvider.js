/* eslint-disable no-console */
// Copyright (c) 2022 Siemens

/**
 * ExpandBelowCallProvider
 *
 * Responsible for providing a sequence of getOccurrences4 calls to be invoked
 * during an ExpandBelow user action. Interacts with tree context to choose
 * best ordering/parameterisation of the calls.
 *
 * Called only by invoker.
 *
 * @module js/invoker/expandBelowCallProvider
 */

import backgroundSoaSvc from 'js/invoker/backgroundSoaService';
import soaSvc from 'soa/kernel/soaService';
import occmgmtGetSvc from 'js/occmgmtGetService';
import occurrencesLoader from 'js/invoker/occurrencesLoader';
import invoker from 'js/invoker/invoker';

export default class ExpandBelowCallProvider {
    // Construct an ExpandBelowCallProvider
    constructor( vmo, occContext, expansionCriteria, nextInChain ) {
        this.nextInChain = nextInChain;
        this.count = 0;
        this.finished = false;
        this.gotFirstProps = false;
        this.threshold = expansionCriteria.loadTreeHierarchyThreshold;
        this.soaInput = occmgmtGetSvc.getExpandBelowSoaInput( vmo, occContext, expansionCriteria );
        this.vmc = occContext.vmc;
        this.occContext = occContext;
    }

    invokeNext() {
        const runawayLimit = 100;
        if ( this.finished || this.count >= runawayLimit ) {
            if ( this.nextInChain !== null ) {
                return this.nextInChain.invokeNext();
            }
            return { calls: 0, finished: true };
        }

        if ( this.count === 2 && !this.gotFirstProps ) {
            // make one call to get props for first page. Hacky, refactor.
            this.gotFirstProps = true;
            return this.nextInChain.invokeNext();
        }

        // Increment call count
        this.count++;

        if( this.count === 1 ) {
            this.soaInput.inputData.requestPref.resetCursor = [ 'true' ];
            this.soaInput.inputData.requestPref.reuseCursor = [ 'false' ];
        } else {
            this.soaInput.inputData.requestPref.resetCursor = [ 'false' ];
            this.soaInput.inputData.requestPref.reuseCursor = [ 'true' ];
        }

        // Fine tune page size for each request. First two requests are tiny to get
        // allow render of first page as soon as possible
        let pageSize = this.count < 3 ? 24 : 1000000 + this.threshold;
        let timeEstimate = this.count < 3 ? pageSize / 1.9 + 225 : this.threshold;
        this.soaInput.inputData.expansionCriteria.loadTreeHierarchyThreshold = pageSize;
        // this.soaInput.inputData.requestPref.startFreshNavigation = [ this.count === 1  ? 'true' : 'false' ];

        let callId = 'occs_' + this.count;
        console.log( callId + ': getOccs_invokeNext(' + pageSize + ')' );

        let avoidSoaService = true;
        let soaService = soaSvc;
        let serviceName = 'foreground';
        if ( avoidSoaService && this.count > 2 && this.occContext.BackGroundSoaDebug === 'true' ) {
            soaService = backgroundSoaSvc;
            serviceName = 'background';
        }

        soaService
            .post( 'Internal-ActiveWorkspaceBom-2022-06-OccurrenceManagement', 'getOccurrences4', this.soaInput )
            .then( function( response ) {
                //console.log( response );
                this.finished =  response.cursor.endReached && !response.parentChildrenInfos.length;
                if ( this.finished ) {
                    console.log( callId + ': received finished from server (endReached)' );
                }
                invoker.callFinished( callId );
                // Make tree nodes, have them added to ViewModelCollection
                let repaint = this.count > 2;
                occurrencesLoader.applyResponseToTree( response, this.vmc, repaint );
            }.bind( this ) );

        // todo: remove when we pass time limit through SOA
        return { calls: 1, type: serviceName, nextAction: 'async', time: timeEstimate, finished: false };
    }
}

