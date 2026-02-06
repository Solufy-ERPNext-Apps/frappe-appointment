import { useState, useRef, useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { motion } from "framer-motion";
import { z } from "zod";
import { ChevronDown, X } from "lucide-react";
import { useFrappeGetDocList } from "frappe-react-sdk";

import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/form";
import { Input } from "@/components/input";
import { Button } from "@/components/button";
import Spinner from "@/components/spinner";

/* ---------------- SCHEMA ---------------- */

const meetingFormSchema = z.object({
  chairperson: z.string().min(1, "Chairperson is required"),
  chairperson_id: z.string().min(1, "Please select a chairperson"),
  host: z.string().email("Invalid host email"),
  participants: z.array(z.string().email()),
});

type MeetingFormValues = z.infer<typeof meetingFormSchema>;

/* ---------------- CLICK OUTSIDE HOOK ---------------- */

function useClickOutside(
  ref: React.RefObject<HTMLElement>,
  handler: () => void
) {
  useEffect(() => {
    const listener = (e: MouseEvent) => {
      if (!ref.current || ref.current.contains(e.target as Node)) return;
      handler();
    };
    document.addEventListener("mousedown", listener);
    return () => document.removeEventListener("mousedown", listener);
  }, [handler]);
}

/* ---------------- COMPONENT ---------------- */

  const MeetingForm = () => {
  const chairpersonRef = useRef<HTMLDivElement>(null);
  const participantRef = useRef<HTMLDivElement>(null);
  const [chairpersonOpen, setChairpersonOpen] = useState(false);
  const [participantOpen, setParticipantOpen] = useState(false);
  const [participantInput, setParticipantInput] = useState("");

  useClickOutside(chairpersonRef, () => setChairpersonOpen(false));
  useClickOutside(participantRef, () => setParticipantOpen(false));

  /* ---------------- USERS ---------------- */

 // Correct fields: 'name' is the ID, 'full_name' is the display name
const { data: users, isLoading } = useFrappeGetDocList("User", {
  fields: ["name", "full_name", "email"],
  filters: [["enabled", "=", 1]],
  limit: 100,
});

// Map standard Frappe fields to your dropdown structure
const availableUsers = users?.map((user) => ({
  id: user.name,         // e.g., "jane@example.com"
  name: user.full_name || user.name, // Display name
  email: user.email,
})) || [];


  /* ---------------- FORM ---------------- */

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      chairperson: "",
      chairperson_id: "",
      host: "",
      participants: [],
    },
  });

  /* ---------------- HANDLERS ---------------- */

  const selectChairperson = (user: {
    id: string;
    name: string;
    email: string;
  }) => {
    form.setValue("chairperson", user.name);
    form.setValue("chairperson_id", user.id);
    form.setValue("host", user.email);
    setChairpersonOpen(false);
  };

  const addParticipant = (email: string) => {
    const current = form.getValues("participants");
    if (!current.includes(email)) {
      form.setValue("participants", [...current, email]);
    }
    setParticipantInput("");
    setParticipantOpen(false);
  };

  /* ---------------- UI ---------------- */

  return (
    <motion.div className="w-full p-6">
      <Form {...form}>
        <form className="space-y-6">

          {/* ---------------- CHAIRPERSON ---------------- */}
          <FormField
            control={form.control}
            name="chairperson"
            render={({ field }) => (
              <FormItem ref={chairpersonRef} className="relative">
                <FormLabel>Chairperson *</FormLabel>
                <FormControl>
                  <div className="relative">
                    <Input
                      {...field}
                      placeholder="Select chairperson"
                      onFocus={() => setChairpersonOpen(true)}
                      onChange={(e) => {
                        field.onChange(e);
                        form.setValue("chairperson_id", "");
                        form.setValue("host", "");
                      }}
                    />
                    <ChevronDown className="absolute right-3 top-3 h-4 w-4 text-muted-foreground" />
                  </div>
                </FormControl>
                <FormMessage />

                {chairpersonOpen && (
                  <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-900 border rounded shadow max-h-48 overflow-auto">
                    {isLoading ? (
                      <div className="p-3 flex justify-center">
                        <Spinner />
                      </div>
                    ) : (
                      availableUsers.map((u) => (
                        <div
                          key={u.id}
                          onMouseDown={() => selectChairperson(u)}
                          className="p-2 text-sm hover:bg-blue-50 cursor-pointer"
                        >
                          {u.name}{" "}
                          <span className="text-muted-foreground">
                            ({u.email})
                          </span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </FormItem>
            )}
          />

          {/* ---------------- PARTICIPANTS ---------------- */}
          <div ref={participantRef} className="relative space-y-2">
            <FormLabel>Add Participants</FormLabel>

            <div className="flex flex-wrap gap-2">
              {form.watch("participants").map((p) => (
                <span
                  key={p}
                  className="bg-blue-100 px-2 py-1 rounded text-xs flex items-center gap-1"
                >
                  {p}
                  <X
                    className="h-3 w-3 cursor-pointer"
                    onClick={() =>
                      form.setValue(
                        "participants",
                        form
                          .getValues("participants")
                          .filter((x) => x !== p)
                      )
                    }
                  />
                </span>
              ))}
            </div>

            <Input
              placeholder="Search user email"
              value={participantInput}
              onFocus={() => setParticipantOpen(true)}
              onChange={(e) => setParticipantInput(e.target.value)}
            />

            {participantOpen && (
              <div className="absolute z-30 mt-1 w-full bg-white dark:bg-slate-900 border rounded shadow max-h-48 overflow-auto">
                {availableUsers
                  .filter((u) =>
                    u.email
                      ?.toLowerCase()
                      .includes(participantInput.toLowerCase())
                  )
                  .map((u) => (
                    <div
                      key={u.id}
                      onMouseDown={() => addParticipant(u.email)}
                      className="p-2 text-sm hover:bg-blue-50 cursor-pointer"
                    >
                      {u.name} — {u.email}
                    </div>
                  ))}
              </div>
            )}
          </div>

          <Button type="submit" className="mt-4">
            Schedule Meeting
          </Button>
        </form>
      </Form>
    </motion.div>
  );
};

export default MeetingForm;