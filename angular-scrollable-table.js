(function (angular) {
    'use strict';

    var isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    angular.module('scrollable-table', [])
        .directive('scrollableTable', ['$timeout', '$q', '$parse', function ($timeout, $q, $parse) {
            return {
                transclude: true,
                restrict: 'E',
                scope: {
                    tableHeight: '=',
                    showFilters: '=?',
                    columnWidths: '='
                },
                template:
                '<div class="scrollableContainer" ' +
                'ng-style=' +
                '"' +
                '{height: tableHeight}' +
                '"' +
                '>' +
                '<div class="headerSpacer"></div>' +
                '<div class="scrollArea" ng-transclude></div>' +
                '</div>',
                controller: ['$scope', '$element', '$attrs', function ($scope, $element, $attrs) {
                    this.getTableElement = function (){
                        return $element;
                    };

                    /**
                     * append handle function to execute after table header resize.
                     */
                    this.appendTableResizingHandler = function (handler){
                        var handlerSequence = $scope.headerResizeHanlers || [];
                        for(var i = 0;i < handlerSequence.length;i++){
                            if(handlerSequence[i].name === handler.name){
                                return;
                            }
                        }
                        handlerSequence.push(handler);
                        $scope.headerResizeHanlers = handlerSequence;
                    };

                    // Set fixed widths for the table headers in case the text overflows.
                    // There's no callback for when rendering is complete, so check the visibility of the table
                    // periodically -- see http://stackoverflow.com/questions/11125078
                    function waitForRender() {
                        var deferredRender = $q.defer();
                        function wait() {
                            if ($element.find("table:visible").length === 0) {
                                $timeout(wait, 100);
                            } else {
                                deferredRender.resolve();
                            }
                        }

                        $timeout(wait);
                        return deferredRender.promise;
                    }

                    var tableElement;
                    function getTable(){
                        if(typeof(tableElement) === 'undefined')
                            tableElement = $element.find('.scrollArea table')[0];
                        return tableElement;
                    }
                    var headerRow,
                        filterRow;
                    function getHeaderRow() {
                        if(typeof(headerRow) === 'undefined')
                            headerRow = $element.find("table th .th-inner-header:visible");
                        return headerRow;
                    }
                    function getFilterRow() {
                        if(typeof(filterRow) === 'undefined')
                            filterRow = $element.find("table th .th-inner:visible");
                        return filterRow;
                    }
                    var headersAreFixed = $q.defer();
                    function fixHeaderWidths() {
                        let table = getTable();
                        if($scope.tableHeight === 'auto')
                            table.style.overflowY = 'hidden';

                        if(table.style.tableLayout === '') {
                            if (!$element.find(".header .th-inner-header").length) {
                                $element.find(".header").wrapInner('<div class="th-inner-header"></div>');
                            }
                            if($element.find(".header .th-inner-header:not(:has(.box))").length) {
                                $element.find(".header .th-inner-header:not(:has(.box))").wrapInner('<div class="box"></div>');
                            }

                            if (!$element.find(".filter .th-inner").length) {
                                $element.find(".filter").wrapInner('<div class="th-inner pt-1 px-1"></div>');
                            }
                            if($element.find(".filter .th-inner:not(:has(.box))").length) {
                                $element.find(".filter .th-inner:not(:has(.box))").wrapInner('<div class="box"></div>');
                            }
                        }

                        table.style.tableLayout = 'auto';
                        let headerRow = getHeaderRow(),
                            filterRow = getFilterRow(),
                            filtersShown = filterRow.length > 0,
                            lastCol = $element.find("table th:visible:last");

                        for(let i=0; i< headerRow.length; i++) {
                            let el = angular.element(headerRow[i]),
                                width = $scope.columnWidths[i] === 0 ? el.parent().width() : $scope.columnWidths[i],
                                headerWidth = width,
                                minWidth,
                                filterEl = filtersShown ? angular.element(filterRow[i]) : undefined;

                            if($scope.columnWidths[i] !== 0) {
                                headerWidth = width;
                            } else {
                                if (lastCol.css("text-align") !== "center") {
                                    let hasScrollbar = $element.find(".scrollArea").height() < parseInt(table.style.height,10);
                                    if (lastCol[0] == el.parent()[0] && hasScrollbar) {
                                        headerWidth += $element.find(".scrollArea").width() - $element.find("tbody tr").width();
                                        headerWidth = Math.max(headerWidth, width);
                                    }
                                }
                                minWidth = _getScale(el.parent().css('min-width'));
                                headerWidth = Math.max(minWidth, headerWidth);
                            }

                            el.css("width", headerWidth);
                            el.parent().css("width", headerWidth);
                            if(typeof(filterEl) !== 'undefined') {
                                filterEl.css("width", headerWidth);
                                filterEl.parent().css("width", headerWidth);
                            }
                        }
                        tableElement.style.tableLayout = 'fixed';
                        headersAreFixed.resolve();
                    }

                    function debounce(func, wait, immediate) {
                        var timeout;
                        return function() {
                            var context = this, args = arguments;
                            var later = function() {
                                timeout = null;
                                if (!immediate) func.apply(context, args);
                            };
                            var callNow = immediate && !timeout;
                            clearTimeout(timeout);
                            timeout = setTimeout(later, wait);
                            if (callNow) func.apply(context, args);
                        };
                    };
                    var headerResizeDebounce = debounce(fixHeaderWidths, 500)
                    $element.find(".scrollArea").scroll(function (event) {
                        var IEWasAMistake = event.target.scrollLeft,
                            headerElement = !isFirefox ? getHeaderRow() : $element.find('thead'),
                            vertScrollOnly = (parseInt(headerElement.css('margin-left'),10) + IEWasAMistake) === 0;

                        if(vertScrollOnly){
                            headerResizeDebounce();
                        }
                        if(!isFirefox) {
                            getFilterRow().css('margin-left', 0 - IEWasAMistake);
                        }
                        headerElement.css('margin-left', 0 - IEWasAMistake);

                    });

                    angular.element(window).on('resize', function(){
                        $timeout(function(){
                            $scope.$apply();
                        });
                    });
                    $scope.$watch(function(){
                        var paddingTop = 86,
                            height = 88;
                        if(!$scope.$eval($scope.showFilters)) {
                            height = 32;
                            paddingTop = 30;
                            $element.find(".scrollArea table .th-inner-header").css('height', height + 'px')
                        }
                        $element.find(".scrollableContainer").css('padding-top', paddingTop + 'px')
                        $element.find(".scrollableContainer .headerSpacer").css('height', height + 'px')

                        return $element.find('.scrollArea').width();
                    }, function(newWidth, oldWidth){
                        if(newWidth * oldWidth <= 0){
                            return;
                        }
                        renderChains();
                    });

                    function renderChains(){
                        var resizeQueue = waitForRender().then(fixHeaderWidths),
                            customHandlers = $scope.headerResizeHanlers || [];
                        for(var i = 0;i < customHandlers.length;i++){
                            resizeQueue = resizeQueue.then(customHandlers[i]);
                        }
                        return resizeQueue;
                    }
                }]
            };
        }]);

    function _getScale(sizeCss){
        return parseInt(sizeCss.replace(/px|%/, ''), 10);
    }
})(angular);
