import { useState } from "react";
import { useForm } from "react-hook-form";
import { motion } from "framer-motion";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { ChevronLeft, ChevronDown, X, CalendarPlus } from "lucide-react";
import { format } from "date-fns";
import { useFrappePostCall } from "frappe-react-sdk";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { Button } from "@/components/button";
import {
  Form,
  FormField,
  FormItem,
  FormLabel,
  FormControl,
  FormMessage,
} from "@/components/form";
import { Input } from "@/components/input";
import Typography from "@/components/typography";
import Spinner from "@/components/spinner";
import { useAppContext } from "@/context/app";
import { getTimeZoneOffsetFromTimeZoneString } from "@/lib/utils";

/* ---------------- SCHEMA ---------------- */

const meetingFormSchema = z.object({
  chairperson: z.string().min(1, "Chairperson is required"),
  host: z.string().email("Enter a valid email"),
  participants: z.array(z.string().email()),
});

type MeetingFormValues = z.infer<typeof meetingFormSchema>;

interface User {
  id: string;
  name: string;
  email: string | null;
}

interface Props {
  onBack: VoidFunction;
  onSuccess: (data: any) => void;
  durationId: string;
  isMobileView: boolean;
}

/* ---------------- COMPONENT ---------------- */

export default function MeetingForm({
  onBack,
  onSuccess,
  durationId,
  isMobileView,
}: Props) {
  const { selectedDate, selectedSlot, timeZone } = useAppContext();
  const [searchParams] = useSearchParams();

  const { call: bookMeeting, loading } = useFrappePostCall(
    "frappe_appointment.api.personal_meet.book_time_slot"
  );

  /* ---------------- STATE ---------------- */

  const [users, setUsers] = useState<User[]>([]);
  const [chairpersonId, setChairpersonId] = useState<string>("");

  const [chairpersonOpen, setChairpersonOpen] = useState(false);
  const [participantsOpen, setParticipantsOpen] = useState(false);
  const [participantsDropdownOpen, setParticipantsDropdownOpen] = useState(false);
  const [participantInput, setParticipantInput] = useState("");

  /* ---------------- FORM ---------------- */

  const form = useForm<MeetingFormValues>({
    resolver: zodResolver(meetingFormSchema),
    defaultValues: {
      chairperson: "",
      host: "",
      participants: [],
    },
  });

  /* ---------------- HELPERS ---------------- */

  const addUserIfMissing = (name: string, email: string | null = null) => {
    const existing = users.find(
      (u) => u.name === name || (email && u.email === email)
    );
    if (existing) return existing;

    const newUser: User = {
      id: crypto.randomUUID(),
      name,
      email,
    };

    setUsers((prev) => [...prev, newUser]);
    return newUser;
  };

  /* ---------------- CHAIRPERSON ---------------- */

  const syncChairperson = () => {
    const name = form.getValues("chairperson").trim();
    if (!name) return;

    const user = addUserIfMissing(name);
    setChairpersonId(user.id);
    setChairpersonOpen(false);
  };

  /* ---------------- PARTICIPANTS ---------------- */

  const addParticipant = () => {
    const email = participantInput.trim();
    if (!email || !email.includes("@")) return;

    const current = form.getValues("participants");
    if (current.includes(email)) return;

    form.setValue("participants", [...current, email]);
    addUserIfMissing(email, email);
    setParticipantInput("");
  };

  const removeParticipant = (email: string) => {
    form.setValue(
      "participants",
      form.getValues("participants").filter((p) => p !== email)
    );
  };

  /* ---------------- SUBMIT ---------------- */

  const onSubmit = async (data: MeetingFormValues) => {
    if (!chairpersonId) {
      toast.error("Please select a valid chairperson");
      return;
    }

    try {
      const extraArgs: Record<string, string> = {};
      searchParams.forEach((v, k) => (extraArgs[k] = v));

      const payload = {
        ...extraArgs,
        duration_id: durationId,
        date: format(selectedDate, "yyyy-MM-dd"),
        start_time: selectedSlot.start_time,
        end_time: selectedSlot.end_time,
        user_timezone_offset: String(
          getTimeZoneOffsetFromTimeZoneString(timeZone)
        ),
        chairperson_name: data.chairperson,
        chairperson_id: chairpersonId,
        host_email: data.host,
        user_name: data.chairperson,
        user_email: data.host,
        participants: data.participants.join(","),
      };

      const res = await bookMeeting(payload);
      onSuccess(res);
    } catch {
      toast.error("Unable to schedule meeting");
    }
  };

  /* ---------------- UI ---------------- */

  return (
    <motion.div
      className="w-full md:p-6"
      initial={isMobileView ? {} : { x: "100%" }}
      animate={{ x: 0 }}
      exit={isMobileView ? {} : { x: "100%" }}
    >
      <Form {...form}>
        <form
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-6 flex flex-col h-full"
        >
          <div className="space-y-4">
            <Typography variant="p" className="text-2xl">
              Meeting Schedule
            </Typography>

            <Typography className="text-sm text-blue-500">
              <CalendarPlus className="inline w-4 h-4 mr-1" />
              {format(selectedDate, "d MMM, yyyy")}
            </Typography>

            {/* CHAIRPERSON */}
            <FormField
              control={form.control}
              name="chairperson"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Chairperson *</FormLabel>
                  <FormControl>
                    <div className="relative">
                      <Input
                        {...field}
                        placeholder="Select or Add Chairperson"
                        onFocus={() => setChairpersonOpen(true)}
                        onBlur={syncChairperson}
                        onChange={(e) => {
                          field.onChange(e);
                          setChairpersonId("");
                        }}
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        className="absolute right-2 top-1/2 -translate-y-1/2"
                        onClick={() => setChairpersonOpen((p) => !p)}
                      >
                        <ChevronDown />
                      </Button>

                      {chairpersonOpen && users.length > 0 && (
                        <div className="absolute z-10 bg-white border w-full mt-1">
                          {users.map((u) => (
                            <div
                              key={u.id}
                              className="p-2 hover:bg-blue-100 cursor-pointer"
                              onMouseDown={() => {
                                form.setValue("chairperson", u.name);
                                setChairpersonId(u.id);
                                setChairpersonOpen(false);
                              }}
                            >
                              {u.name}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* HOST */}
            <FormField
              control={form.control}
              name="host"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Host *</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      placeholder="host@example.com"
                      onBlur={(e) =>
                        addUserIfMissing(e.target.value, e.target.value)
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            {/* PARTICIPANTS */}
            <Button
              type="button"
              variant="ghost"
              onClick={() => setParticipantsOpen((p) => !p)}
            >
              {participantsOpen ? "Hide Participants" : "+ Add Participants"}
            </Button>

            {participantsOpen && (
              <>
                <div className="relative">
                  <Input
                    value={participantInput}
                    placeholder="Enter email and press Enter"
                    onChange={(e) => setParticipantInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === ",") {
                        e.preventDefault();
                        addParticipant();
                      }
                    }}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    className="absolute right-2 top-1/2 -translate-y-1/2"
                    onClick={() =>
                      setParticipantsDropdownOpen((p) => !p)
                    }
                  >
                    <ChevronDown />
                  </Button>

                  {participantsDropdownOpen && (
                    <div className="absolute bg-white border w-full mt-1 z-10">
                      {users
                        .filter((u) => u.email)
                        .map((u) => (
                          <div
                            key={u.id}
                            className="p-2 hover:bg-blue-100 cursor-pointer"
                            onMouseDown={() => {
                              const current =
                                form.getValues("participants");
                              if (!current.includes(u.email!)) {
                                form.setValue("participants", [
                                  ...current,
                                  u.email!,
                                ]);
                              }
                              setParticipantsDropdownOpen(false);
                            }}
                          >
                            {u.email}
                          </div>
                        ))}
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  {form.watch("participants").map((p) => (
                    <span
                      key={p}
                      className="bg-blue-500 text-white px-3 py-1 rounded-full flex items-center gap-1"
                    >
                      {p}
                      <X
                        className="w-3 h-3 cursor-pointer"
                        onClick={() => removeParticipant(p)}
                      />
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* FOOTER */}
          <div className="flex justify-between">
            <Button variant="ghost" type="button" onClick={onBack}>
              <ChevronLeft /> Back
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Spinner />} Schedule Meeting
            </Button>
          </div>
        </form>
      </Form>
    </motion.div>
  );
}