import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Eye, Download, Trash2, Tag, Calendar, User, FileText, Filter, X } from "lucide-react";
import { DocumentMetadata, searchDocuments, groupDocumentsByCategory, DOCUMENT_CATEGORIES, DOCUMENT_DEPARTMENTS, formatFileSize } from "@/lib/document-utils";

interface DocumentManagerProps {
  documents: DocumentMetadata[];
  onDelete?: (id: string) => void;
  onDownload?: (id: string) => void;
  onPreview?: (id: string) => void;
  allowMetadataEdit?: boolean;
}

export function DocumentManager({
  documents,
  onDelete,
  onDownload,
  onPreview,
  allowMetadataEdit = false,
}: DocumentManagerProps) {
  const [searchText, setSearchText] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingData, setEditingData] = useState<Partial<DocumentMetadata>>({});

  const filtered = searchDocuments(documents, {
    category: selectedCategory || undefined,
    department: selectedDepartment || undefined,
    searchText: searchText || undefined,
  });

  const grouped = groupDocumentsByCategory(filtered);
  const categories = Object.keys(grouped);

  const handleEditStart = (doc: DocumentMetadata) => {
    setEditingId(doc.id);
    setEditingData(doc);
  };

  const handleEditSave = () => {
    // TODO: Implement metadata update API call
    setEditingId(null);
    setEditingData({});
  };

  if (documents.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          No documents yet. Upload your first document to get started.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-3">
      {/* Search & Filter Bar */}
      <Card>
        <CardContent className="p-3 space-y-2">
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                placeholder="Search documents..."
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                className="h-8 text-xs"
              />
            </div>
            <Button
              size="sm"
              variant={showFilters ? "default" : "outline"}
              className="h-8 text-xs"
              onClick={() => setShowFilters(!showFilters)}
            >
              <Filter className="w-3 h-3 mr-1" />
              Filters
            </Button>
          </div>

          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t">
              <div>
                <Label className="text-xs">Category</Label>
                <Select value={selectedCategory || "all"} onValueChange={(v) => setSelectedCategory(v === "all" ? null : v)}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Categories</SelectItem>
                    {DOCUMENT_CATEGORIES.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs">Department</Label>
                <Select value={selectedDepartment || "all"} onValueChange={(v) => setSelectedDepartment(v === "all" ? null : v)}>
                  <SelectTrigger className="h-7 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Departments</SelectItem>
                    {DOCUMENT_DEPARTMENTS.map((dept) => (
                      <SelectItem key={dept} value={dept}>
                        {dept}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Results summary */}
      <div className="flex justify-between items-center px-1">
        <p className="text-xs text-muted-foreground">
          Showing {filtered.length} of {documents.length} documents
        </p>
      </div>

      {/* Documents grouped by category */}
      {categories.length === 0 ? (
        <Card>
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            No documents match your search.
          </CardContent>
        </Card>
      ) : (
        categories.map((category) => (
          <div key={category} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground flex items-center gap-2 px-1">
              <FileText className="w-3 h-3" />
              {category}
              <Badge variant="secondary" className="text-xs ml-auto">
                {grouped[category].length}
              </Badge>
            </h3>

            <div className="space-y-1">
              {grouped[category].map((doc) => (
                <Card key={doc.id} className="hover:bg-muted/50 transition">
                  <CardContent className="p-2">
                    {editingId === doc.id ? (
                      /* Edit mode */
                      <div className="space-y-2">
                        <div>
                          <Label className="text-xs">Description</Label>
                          <Input
                            value={editingData.description || ""}
                            onChange={(e) =>
                              setEditingData({ ...editingData, description: e.target.value })
                            }
                            placeholder="Add description"
                            className="h-6 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">Tags (comma-separated)</Label>
                          <Input
                            value={(editingData.tags || []).join(", ")}
                            onChange={(e) =>
                              setEditingData({
                                ...editingData,
                                tags: e.target.value.split(",").map((t) => t.trim()),
                              })
                            }
                            placeholder="urgent, important"
                            className="h-6 text-xs"
                          />
                        </div>
                        <div className="flex gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-6 text-xs flex-1"
                            onClick={() => setEditingId(null)}
                          >
                            Cancel
                          </Button>
                          <Button
                            size="sm"
                            className="h-6 text-xs flex-1"
                            onClick={handleEditSave}
                          >
                            Save
                          </Button>
                        </div>
                      </div>
                    ) : (
                      /* View mode */
                      <div className="space-y-2">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <p className="font-medium text-sm truncate">{doc.fileName}</p>
                            {doc.description && (
                              <p className="text-xs text-muted-foreground line-clamp-1">
                                {doc.description}
                              </p>
                            )}
                          </div>
                          <Badge variant="outline" className="text-xs ml-2">
                            {formatFileSize(doc.fileSize)}
                          </Badge>
                        </div>

                        <div className="flex flex-wrap gap-1">
                          {doc.tags && doc.tags.length > 0 && (
                            doc.tags.map((tag) => (
                              <Badge key={tag} variant="secondary" className="text-xs">
                                <Tag className="w-2 h-2 mr-1" />
                                {tag}
                              </Badge>
                            ))
                          )}
                        </div>

                        <div className="flex flex-wrap gap-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Calendar className="w-3 h-3" />
                            {new Date(doc.uploadedAt).toLocaleDateString("en-IN")}
                          </span>
                          {doc.uploadedBy && (
                            <span className="flex items-center gap-1">
                              <User className="w-3 h-3" />
                              {doc.uploadedBy}
                            </span>
                          )}
                          {doc.department && (
                            <span className="bg-muted px-1.5 rounded text-xs">
                              {doc.department}
                            </span>
                          )}
                        </div>

                        <div className="flex gap-1 pt-1 border-t">
                          {onPreview && doc.fileType.startsWith("image/") && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => onPreview(doc.id)}
                              title="Preview"
                            >
                              <Eye className="w-3 h-3" />
                            </Button>
                          )}
                          {onDownload && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => onDownload(doc.id)}
                              title="Download"
                            >
                              <Download className="w-3 h-3" />
                            </Button>
                          )}
                          {allowMetadataEdit && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={() => handleEditStart(doc)}
                              title="Edit"
                            >
                              <Tag className="w-3 h-3" />
                            </Button>
                          )}
                          {onDelete && (
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6 text-red-600 hover:text-red-700 ml-auto"
                              onClick={() => onDelete(doc.id)}
                              title="Delete"
                            >
                              <Trash2 className="w-3 h-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );
}
