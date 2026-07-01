import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Lightbulb, Plus } from "lucide-react";
import {
  getRecommendationsForDiagnosis,
  getPriorityColor,
  getPriorityIcon,
} from "@/lib/test-recommendations";

interface SmartTestRecommendationsProps {
  diagnosis: string;
  selectedTests?: string[];
  onSelectTest?: (test: string) => void;
  className?: string;
}

export default function SmartTestRecommendations({
  diagnosis,
  selectedTests = [],
  onSelectTest,
  className = "",
}: SmartTestRecommendationsProps) {
  if (!diagnosis.trim()) {
    return null;
  }

  const recommendations = getRecommendationsForDiagnosis(diagnosis);

  if (!recommendations) {
    return null;
  }

  const allTests = [
    ...recommendations.critical,
    ...recommendations.important,
    ...recommendations.optional,
  ];

  return (
    <Card className={`border-2 border-emerald-200 dark:border-emerald-800 ${className}`}>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Lightbulb className="w-4 h-4 text-emerald-600" />
          Smart Test Recommendations
        </CardTitle>
        <p className="text-xs text-muted-foreground mt-1">
          Based on diagnosis: <span className="font-semibold">{diagnosis}</span>
        </p>
      </CardHeader>

      <CardContent className="space-y-3">
        {/* Critical Tests */}
        {recommendations.critical.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-red-700 dark:text-red-300 mb-2">
              🚨 Critical Tests (Order Immediately)
            </div>
            <div className="space-y-2">
              {recommendations.critical.map((test, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-2 ${getPriorityColor(test.priority)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <span className="text-lg">{getPriorityIcon(test.priority)}</span>
                        {test.test}
                        <Badge variant="outline" className="text-[9px]">
                          {test.type}
                        </Badge>
                      </div>
                      <div className="text-xs mt-1 opacity-90">{test.reason}</div>
                      <div className="text-[10px] opacity-75 mt-1">⏱️ {test.timing}</div>
                    </div>
                    {onSelectTest && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelectTest(test.test)}
                        className={`h-7 px-2 text-xs rounded-lg ${
                          selectedTests.includes(test.test)
                            ? "bg-green-500 text-white"
                            : "hover:bg-white/30 dark:hover:bg-black/30"
                        }`}
                        title={selectedTests.includes(test.test) ? "Added" : "Add to investigations"}
                      >
                        {selectedTests.includes(test.test) ? "✓" : <Plus className="w-3 h-3" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Important Tests */}
        {recommendations.important.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-yellow-700 dark:text-yellow-300 mb-2">
              ⚠️ Important Tests (Order Soon)
            </div>
            <div className="space-y-2">
              {recommendations.important.map((test, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-2 ${getPriorityColor(test.priority)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <span className="text-lg">{getPriorityIcon(test.priority)}</span>
                        {test.test}
                        <Badge variant="outline" className="text-[9px]">
                          {test.type}
                        </Badge>
                      </div>
                      <div className="text-xs mt-1 opacity-90">{test.reason}</div>
                      <div className="text-[10px] opacity-75 mt-1">⏱️ {test.timing}</div>
                    </div>
                    {onSelectTest && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelectTest(test.test)}
                        className={`h-7 px-2 text-xs rounded-lg ${
                          selectedTests.includes(test.test)
                            ? "bg-green-500 text-white"
                            : "hover:bg-white/30 dark:hover:bg-black/30"
                        }`}
                        title={selectedTests.includes(test.test) ? "Added" : "Add to investigations"}
                      >
                        {selectedTests.includes(test.test) ? "✓" : <Plus className="w-3 h-3" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Optional Tests */}
        {recommendations.optional.length > 0 && (
          <div>
            <div className="text-xs font-semibold text-blue-700 dark:text-blue-300 mb-2">
              ℹ️ Optional Tests (Consider)
            </div>
            <div className="space-y-2">
              {recommendations.optional.map((test, idx) => (
                <div
                  key={idx}
                  className={`border rounded-lg p-2 ${getPriorityColor(test.priority)}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="font-semibold text-sm flex items-center gap-2">
                        <span className="text-lg">{getPriorityIcon(test.priority)}</span>
                        {test.test}
                        <Badge variant="outline" className="text-[9px]">
                          {test.type}
                        </Badge>
                      </div>
                      <div className="text-xs mt-1 opacity-90">{test.reason}</div>
                      <div className="text-[10px] opacity-75 mt-1">⏱️ {test.timing}</div>
                    </div>
                    {onSelectTest && (
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onSelectTest(test.test)}
                        className={`h-7 px-2 text-xs rounded-lg ${
                          selectedTests.includes(test.test)
                            ? "bg-green-500 text-white"
                            : "hover:bg-white/30 dark:hover:bg-black/30"
                        }`}
                        title={selectedTests.includes(test.test) ? "Added" : "Add to investigations"}
                      >
                        {selectedTests.includes(test.test) ? "✓" : <Plus className="w-3 h-3" />}
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="text-xs text-slate-600 dark:text-slate-400 italic border-t pt-2">
          💡 These recommendations are based on clinical best practices. Always apply clinical judgment for individual patient needs.
        </div>
      </CardContent>
    </Card>
  );
}
