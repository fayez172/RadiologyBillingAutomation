"use client";

import { useState, useEffect } from "react";
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Plus, Edit2, Save, X, Trash2 } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";

interface BillingType {
  id: string;
  name: string;
  display_name: string;
  modalities: string;
  default_hospital_price: number;
  default_radiologist_price: number;
  is_billable: boolean;
  is_active: boolean;
  sort_order: number;
}

export default function BillingTypesPage() {
  const [types, setTypes] = useState<BillingType[]>([]);
  const [availableModalities, setAvailableModalities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    display_name: "",
    modalities: "",
    default_hospital_price: "0",
    default_radiologist_price: "0",
    is_billable: true,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchTypes();
    fetch('/api/reference/modalities').then(res => res.json()).then(data => setAvailableModalities(data || []));
  }, []);

  const fetchTypes = async () => {
    try {
      const res = await fetch("/api/config/billing-types");
      const data = await res.json();
      setTypes(data);
    } catch (error) {
      toast({ title: "Error", description: "Failed to fetch billing types", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreate = async () => {
    try {
      const res = await fetch("/api/config/billing-types", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      if (!res.ok) throw new Error("Failed to create");
      toast({ title: "Success", description: "Billing type created successfully" });
      setIsDialogOpen(false);
      resetForm();
      fetchTypes();
    } catch (error) {
      toast({ title: "Error", description: "Failed to create billing type", variant: "destructive" });
    }
  };

  const handleUpdate = async (id: string, data: Partial<BillingType>) => {
    try {
      const res = await fetch(`/api/config/billing-types/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error("Failed to update");
      toast({ title: "Success", description: "Updated successfully" });
      setEditingId(null);
      fetchTypes();
    } catch (error) {
      toast({ title: "Error", description: "Failed to update", variant: "destructive" });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Are you sure you want to delete this billing type?")) return;
    try {
      const res = await fetch(`/api/config/billing-types/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete");
      toast({ title: "Success", description: "Deleted successfully" });
      fetchTypes();
    } catch (error) {
      toast({ title: "Error", description: "Failed to delete", variant: "destructive" });
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      display_name: "",
      modalities: "",
      default_hospital_price: "0",
      default_radiologist_price: "0",
      is_billable: true,
    });
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Billing Types</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage standardized billing categories, display names, and default pricing.
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger render={
            <Button onClick={resetForm} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="w-4 h-4 mr-2" /> Add Type
            </Button>
          } />
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>Add New Billing Type</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Internal Name (Code)</Label>
                  <Input 
                    placeholder="e.g. X-Ray_Single_View" 
                    value={formData.name}
                    onChange={e => setFormData({ ...formData, name: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Display Name</Label>
                  <Input 
                    placeholder="e.g. X-Ray Single View" 
                    value={formData.display_name}
                    onChange={e => setFormData({ ...formData, display_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Modalities</Label>
                <div className="flex flex-wrap gap-2 mt-1">
                  {availableModalities.map(m => {
                    const selected = formData.modalities.split(',').map(s=>s.trim()).includes(m.id);
                    return (
                      <Badge 
                        key={m.id} 
                        variant={selected ? "default" : "outline"}
                        className={`cursor-pointer ${selected ? 'bg-primary/20 text-primary border-primary/30' : 'hover:bg-muted/50'}`}
                        onClick={() => {
                          let arr = formData.modalities.split(',').map(s=>s.trim()).filter(Boolean);
                          if (arr.includes(m.id)) {
                             arr = arr.filter(a => a !== m.id);
                          } else {
                             arr.push(m.id);
                          }
                          setFormData({ ...formData, modalities: arr.join(', ') });
                        }}
                      >
                        {m.name || m.id}
                      </Badge>
                    );
                  })}
                  {availableModalities.length === 0 && <span className="text-xs text-muted-foreground">Loading...</span>}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Default Hospital Price</Label>
                  <Input 
                    type="number"
                    value={formData.default_hospital_price}
                    onChange={e => setFormData({ ...formData, default_hospital_price: e.target.value })}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Default Rad Price</Label>
                  <Input 
                    type="number"
                    value={formData.default_radiologist_price}
                    onChange={e => setFormData({ ...formData, default_radiologist_price: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2 pt-2">
                <Switch 
                  id="create-billable" 
                  checked={formData.is_billable}
                  onCheckedChange={checked => setFormData({ ...formData, is_billable: checked })}
                />
                <Label htmlFor="create-billable">Billable Type</Label>
              </div>
              <div className="flex justify-end gap-2 pt-4">
                <Button variant="outline" onClick={() => setIsDialogOpen(false)}>Cancel</Button>
                <Button onClick={handleCreate}>Save Type</Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Card className="border-none shadow-md overflow-hidden bg-background/50 backdrop-blur">
        <CardHeader className="bg-card/50 border-b">
          <CardTitle className="text-lg font-medium">Standard Types Configuration</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader className="bg-muted/50">
              <TableRow>
                <TableHead className="w-[100px]">Status</TableHead>
                <TableHead>Code Name</TableHead>
                <TableHead>Display Name</TableHead>
                <TableHead>Modalities</TableHead>
                <TableHead className="text-right">Hospital (Default)</TableHead>
                <TableHead className="text-right">Rad (Default)</TableHead>
                <TableHead className="w-[120px] text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground italic">
                    Loading billing types...
                  </TableCell>
                </TableRow>
              ) : types.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-muted-foreground italic">
                    No billing types defined. Add one above.
                  </TableCell>
                </TableRow>
              ) : (
                types.map((type) => (
                  <TableRow key={type.id} className="hover:bg-muted/30 group">
                    <TableCell>
                      <div className="flex flex-col gap-1">
                        <Badge variant={type.is_active ? "default" : "secondary"} className="w-fit text-[10px] px-1 h-4">
                          {type.is_active ? "Active" : "Disabled"}
                        </Badge>
                        <Badge variant={type.is_billable ? "outline" : "secondary"} className="w-fit text-[10px] px-1 h-4 bg-blue-500/10 text-blue-500">
                          {type.is_billable ? "Billable" : "Internal"}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{type.name}</TableCell>
                    <TableCell>
                      {editingId === type.id ? (
                        <Input 
                          defaultValue={type.display_name} 
                          id={`display_name_${type.id}`}
                          className="h-8 py-0"
                        />
                      ) : (
                        <span className="font-medium">{type.display_name}</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {editingId === type.id ? (
                        <Input 
                          defaultValue={type.modalities} 
                          id={`modalities_${type.id}`}
                          className="h-8 py-0"
                        />
                      ) : (
                        <span className="text-xs text-muted-foreground">{type.modalities}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono">
                      {editingId === type.id ? (
                        <Input 
                          type="number"
                          defaultValue={type.default_hospital_price} 
                          id={`price_h_${type.id}`}
                          className="h-8 py-0 w-20 ml-auto"
                        />
                      ) : (
                        <span>৳{Number(type.default_hospital_price).toLocaleString()}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-mono text-muted-foreground">
                      {editingId === type.id ? (
                        <Input 
                          type="number"
                          defaultValue={type.default_radiologist_price} 
                          id={`price_r_${type.id}`}
                          className="h-8 py-0 w-20 ml-auto"
                        />
                      ) : (
                        <span>৳{Number(type.default_radiologist_price).toLocaleString()}</span>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {editingId === type.id ? (
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-green-500 hover:text-green-600 hover:bg-green-500/10"
                            onClick={() => {
                              const display_name = (document.getElementById(`display_name_${type.id}`) as HTMLInputElement).value;
                              const modalities = (document.getElementById(`modalities_${type.id}`) as HTMLInputElement).value;
                              const hospital = (document.getElementById(`price_h_${type.id}`) as HTMLInputElement).value;
                              const rad = (document.getElementById(`price_r_${type.id}`) as HTMLInputElement).value;
                              handleUpdate(type.id, { 
                                display_name, 
                                modalities,
                                default_hospital_price: parseFloat(hospital),
                                default_radiologist_price: parseFloat(rad)
                              });
                            }}
                          >
                            <Save className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 text-red-500 hover:text-red-600"
                            onClick={() => setEditingId(null)}
                          >
                            <X className="w-4 h-4" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex justify-end gap-1">
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 group-hover:bg-blue-500/10 group-hover:text-blue-500"
                            onClick={() => setEditingId(type.id)}
                          >
                            <Edit2 className="w-4 h-4" />
                          </Button>
                          <Button 
                            variant="ghost" 
                            size="icon" 
                            className="h-8 w-8 group-hover:bg-red-500/10 group-hover:text-red-500"
                            onClick={() => handleDelete(type.id)}
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
