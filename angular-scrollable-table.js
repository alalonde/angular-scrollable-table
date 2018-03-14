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
                'style=' +
                '"' +
                'height: {{tableHeight}}' +
                '"' +
                '>' +
                '<div class="headerSpacer"></div>' +
                '<div class="scrollArea" ng-transclude></div>' +
                '</div>',
                controller: ['$scope', '$element', '$attrs', function ($scope, $element, $attrs) {
                    // define an API for child directives to view and modify sorting parameters
                    this.renderTable = function (){
                        return waitForRender().then(fixHeaderWidths);
                    };

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

                    var headersAreFixed = $q.defer();

                    function fixHeaderWidths() {
                        /*
                         $element.find(".filter");
                         $element.find(".header");
                         * */
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


                        $element.find("table th .th-inner-header:visible").each(function (index, el) {
                            el = angular.element(el);
                            var width = $scope.columnWidths[index] === 0 ? el.parent().width() : $scope.columnWidths[index],
                                lastCol = $element.find("table th:visible:last"),
                                headerWidth = width;
                            if (lastCol.css("text-align") !== "center") {
                                var hasScrollbar = $element.find(".scrollArea").height() < $element.find("table").height();
                                if (lastCol[0] == el.parent()[0] && hasScrollbar) {
                                    headerWidth += $element.find(".scrollArea").width() - $element.find("tbody tr").width();
                                    headerWidth = Math.max(headerWidth, width);
                                }
                            }
                            var minWidth = _getScale(el.parent().css('min-width'));
                            headerWidth = Math.max(minWidth, headerWidth);
                            el.css("width", headerWidth);
                            el.parent().css("width", headerWidth);
                        });

                        $element.find("table th .th-inner:visible").each(function (index, el) {
                            el = angular.element(el);
                            var width = $scope.columnWidths[index] === 0 ? el.parent().width() : $scope.columnWidths[index],
                                lastCol = $element.find("table th:visible:last"),
                                headerWidth = width;
                            if (lastCol.css("text-align") !== "center") {
                                var hasScrollbar = $element.find(".scrollArea").height() < $element.find("table").height();
                                if (lastCol[0] == el.parent()[0] && hasScrollbar) {
                                    headerWidth += $element.find(".scrollArea").width() - $element.find("tbody tr").width();
                                    headerWidth = Math.max(headerWidth, width);
                                }
                            }
                            var minWidth = _getScale(el.parent().css('min-width'));
                            headerWidth = Math.max(minWidth, headerWidth);
                            el.css("width", headerWidth);
                            el.parent().css("width", headerWidth);
                        });
                        headersAreFixed.resolve();
                    }

                    var tableElement = $element.find('.scrollArea table').css('width');
                    var headerElementToFakeScroll = isFirefox ? "thead" : "thead th .th-inner",
                        secondHeaderElementToFakeScroll = isFirefox ? "thead" : "thead th .th-inner-header";
                    $element.find(".scrollArea").scroll(function (event) {
                        var IEWasAMistake = event.target.scrollLeft;
                        $element.find(secondHeaderElementToFakeScroll).css('margin-left', 0 - IEWasAMistake);
                        $element.find(headerElementToFakeScroll).css('margin-left', 0 - IEWasAMistake);
                    });

                    $scope.$on("renderScrollableTable", function() {
                        renderChains($element.find('.scrollArea').width());
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
